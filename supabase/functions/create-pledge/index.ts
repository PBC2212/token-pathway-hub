// File: supabase/functions/create-pledge/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { FireblocksSDK } from 'https://esm.sh/@fireblocks/ts-sdk@1.6.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PledgeRequest {
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_symbol: string;
  contract_address: string;
  description: string;
  document_hash?: string;
  appraisal_date?: string;
  appraiser_license?: string;
}

interface BlockchainPledgeRequest {
  escrowContract: string;
  assetType: number;
  appraisedValue: number;
  metadata: {
    description: string;
    documentHash: string;
    appraisalDate: string;
    appraiserLicense?: string;
  };
  walletAddress: string;
  vaultAccountId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the request data
    const pledgeData: PledgeRequest = await req.json()

    // Validate required fields
    if (!pledgeData.user_address || !pledgeData.asset_type || !pledgeData.appraised_value) {
      throw new Error('Missing required fields')
    }

    // Get current session for user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization required')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid authorization')
    }

    // Generate unique pledge ID
    const pledgeId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000)

    // Create database record first
    const { data: dbPledge, error: dbError } = await supabase
      .from('pledges')
      .insert({
        pledge_id: pledgeId,
        user_id: user.id,
        user_address: pledgeData.user_address,
        asset_type: pledgeData.asset_type,
        appraised_value: pledgeData.appraised_value,
        token_symbol: pledgeData.token_symbol,
        contract_address: pledgeData.contract_address,
        description: pledgeData.description,
        document_hash: pledgeData.document_hash || '',
        appraisal_date: pledgeData.appraisal_date || new Date().toISOString(),
        appraiser_license: pledgeData.appraiser_license,
        status: 'pending'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('Failed to create pledge record')
    }

    // If we have contract address and document hash, also create blockchain pledge
    let blockchainResult = null
    if (pledgeData.contract_address && pledgeData.document_hash) {
      try {
        blockchainResult = await createBlockchainPledge({
          escrowContract: pledgeData.contract_address,
          assetType: getAssetTypeNumber(pledgeData.asset_type),
          appraisedValue: pledgeData.appraised_value,
          metadata: {
            description: pledgeData.description,
            documentHash: pledgeData.document_hash,
            appraisalDate: pledgeData.appraisal_date || new Date().toISOString(),
            appraiserLicense: pledgeData.appraiser_license
          },
          walletAddress: pledgeData.user_address,
          vaultAccountId: Deno.env.get('FIREBLOCKS_VAULT_ACCOUNT_ID') || ''
        })

        // Update database with blockchain transaction info
        if (blockchainResult.transactionId) {
          await supabase
            .from('blockchain_transactions')
            .insert({
              transaction_id: blockchainResult.transactionId,
              transaction_type: 'CREATE_PLEDGE',
              user_address: pledgeData.user_address,
              contract_address: pledgeData.contract_address,
              transaction_data: {
                pledgeId,
                assetType: getAssetTypeNumber(pledgeData.asset_type),
                appraisedValue: pledgeData.appraised_value,
                fireblocksId: blockchainResult.transactionId
              },
              status: 'PENDING'
            })
        }
      } catch (blockchainError) {
        console.error('Blockchain creation failed:', blockchainError)
        // Don't fail the entire request if blockchain fails
        // The pledge record is still created in the database
      }
    }

    const response = {
      success: true,
      message: 'Pledge created successfully',
      pledgeId: pledgeId,
      data: dbPledge,
      blockchainTransaction: blockchainResult?.transactionId || null
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error creating pledge:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function createBlockchainPledge(request: BlockchainPledgeRequest): Promise<any> {
  try {
    // Initialize Fireblocks SDK
    const fireblocks = new FireblocksSDK({
      apiKey: Deno.env.get('FIREBLOCKS_API_KEY')!,
      privateKey: Deno.env.get('FIREBLOCKS_PRIVATE_KEY')!,
      baseUrl: Deno.env.get('FIREBLOCKS_BASE_URL') || 'https://api.fireblocks.io'
    });

    // Validate inputs
    if (!request.escrowContract || !request.walletAddress || !request.vaultAccountId) {
      throw new Error('Missing required parameters for blockchain transaction')
    }

    // Convert appraised value to Wei (assuming 18 decimals for value representation)
    const appraisedValueWei = (request.appraisedValue * 1e18).toString()

    // Prepare metadata for IPFS storage
    const metadataJson = JSON.stringify({
      name: `Asset Pledge - ${request.metadata.description.substring(0, 50)}`,
      description: request.metadata.description,
      attributes: [
        { trait_type: "Asset Type", value: getAssetTypeName(request.assetType) },
        { trait_type: "Appraised Value", value: `$${request.appraisedValue}` },
        { trait_type: "Appraisal Date", value: request.metadata.appraisalDate },
        { trait_type: "Document Hash", value: request.metadata.documentHash }
      ],
      external_url: `${Deno.env.get('APP_URL')}/pledge/${request.walletAddress}`,
      image: generateAssetImage(request.assetType)
    })

    // Store metadata on IPFS (simplified - in production use proper IPFS service)
    const metadataHash = await storeOnIPFS(metadataJson)

    // Prepare smart contract transaction data using simple hex encoding
    // Note: In production, you'd want to use proper ABI encoding
    const functionSelector = '0x12345678' // This should be the actual function selector for createPledge
    const paddedAssetType = request.assetType.toString(16).padStart(64, '0')
    const paddedValue = BigInt(appraisedValueWei).toString(16).padStart(64, '0')
    
    // Simple contract call data (this would need proper ABI encoding in production)
    const txData = functionSelector + paddedAssetType + paddedValue

    // Create Fireblocks transaction
    const transactionRequest = {
      operation: 'CONTRACT_CALL',
      source: {
        type: 'VAULT_ACCOUNT',
        id: request.vaultAccountId
      },
      destination: {
        type: 'EXTERNAL_WALLET',
        oneTimeAddress: {
          address: request.escrowContract,
          tag: ''
        }
      },
      assetId: 'ETH', // or the appropriate blockchain asset
      amount: '0', // No ETH transfer, just contract call
      extraParameters: {
        contractCallData: txData
      },
      note: `Asset Pledge Creation - ${request.metadata.description.substring(0, 100)}`
    }

    // Submit transaction to Fireblocks
    const transactionResult = await fireblocks.transactions.createTransaction(transactionRequest)

    return {
      success: true,
      transactionId: transactionResult.id,
      message: 'Pledge submitted to blockchain via Fireblocks',
      metadataHash
    }

  } catch (error) {
    console.error('Error creating blockchain pledge:', error)
    throw error
  }
}

function getAssetTypeNumber(assetType: string): number {
  const typeMap: Record<string, number> = {
    'real_estate': 0,
    'gold': 1,
    'vehicle': 2,
    'art': 3,
    'equipment': 4,
    'commodity': 5
  }
  return typeMap[assetType] || 0
}

function getAssetTypeName(assetType: number): string {
  const types = ['Real Estate', 'Gold', 'Vehicle', 'Art', 'Equipment', 'Commodity']
  return types[assetType] || 'Unknown'
}

function generateAssetImage(assetType: number): string {
  const baseUrl = Deno.env.get('CDN_URL') || 'https://your-cdn.com'
  const images = [
    'real-estate.png',
    'gold.png', 
    'vehicle.png',
    'art.png',
    'equipment.png',
    'commodity.png'
  ]
  return `${baseUrl}/assets/${images[assetType] || 'default.png'}`
}

async function storeOnIPFS(data: string): Promise<string> {
  try {
    // Simplified IPFS storage - replace with actual IPFS service like Pinata
    const ipfsUrl = Deno.env.get('IPFS_API_URL')
    const ipfsToken = Deno.env.get('IPFS_JWT_TOKEN')
    
    if (!ipfsUrl || !ipfsToken) {
      // Return a mock hash if IPFS is not configured
      return 'QmMockHashForTesting' + Math.random().toString(36).substring(7)
    }

    const formData = new FormData()
    formData.append('file', new Blob([data], { type: 'application/json' }), 'metadata.json')
    
    const response = await fetch(`${ipfsUrl}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ipfsToken}`
      },
      body: formData
    })
    
    if (!response.ok) {
      throw new Error('Failed to store on IPFS')
    }
    
    const result = await response.json()
    return result.IpfsHash || 'QmMockHash'
    
  } catch (error) {
    console.error('IPFS storage error:', error)
    // Return a mock hash if IPFS fails
    return 'QmMockHashForTesting' + Math.random().toString(36).substring(7)
  }
}