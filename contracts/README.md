# Asset Tokenization Smart Contracts

This directory contains production-ready smart contracts for tokenizing real-world assets on the blockchain.

## Contract Architecture

### Core Contracts

#### 1. BaseAssetToken.sol
The foundational contract that all asset-specific tokens inherit from. Provides:
- **Enhanced ERC20 functionality** with permit support
- **Metadata storage** for asset details (appraisal, location, documents)
- **Access control** with roles (MINTER, PAUSER, COMPLIANCE)
- **Compliance features** (blacklisting, whitelisting)
- **Pausable functionality** for emergency stops
- **Supply cap management**
- **Transfer restrictions** for regulatory compliance

#### 2. Asset-Specific Tokens

##### RealEstateToken.sol (RET)
- Property-specific metadata (square footage, zoning, rental income)
- Property type validation
- Rental income tracking
- Legal description storage

##### GoldToken.sol (GLD)  
- Precious metal specifications (purity, weight, form)
- Certification tracking
- Allocated vs unallocated gold support
- Market value calculations

##### VehicleToken.sol (VET)
- Automotive data (make, model, VIN, mileage)
- VIN uniqueness enforcement
- Accident history tracking
- Title status management

##### ArtToken.sol (ART)
- Artwork metadata (artist, provenance, exhibitions)
- Authentication tracking
- Limited edition support
- Provenance history management

#### 3. AssetTokenFactory.sol
Factory contract for deploying and managing asset token contracts:
- **Standardized deployment** of asset-specific contracts
- **Registry system** for tracking all deployed contracts
- **Asset type categorization**
- **Contract status management** (active/inactive)

### Interfaces

#### IAssetMetadata.sol
Interface defining standard metadata functionality across all asset tokens.

## Features

### Security Features
- **Role-based access control** using OpenZeppelin's AccessControl
- **Reentrancy protection** on all state-changing functions
- **Pausable functionality** for emergency situations
- **Input validation** and custom error messages
- **Transfer restrictions** for compliance

### Compliance Features
- **Blacklist/Whitelist** address management
- **KYC/AML integration points** ready for external compliance services
- **Audit trails** with comprehensive event logging
- **Regulatory compliance** hooks for future requirements

### Metadata Management
- **IPFS integration** for document storage
- **Appraiser tracking** and re-appraisal functionality
- **Verification system** for asset authenticity
- **Asset-specific data** tailored to each asset class

### Production Readiness
- **Gas optimization** using efficient data structures
- **Upgradeability considerations** through factory pattern
- **Event logging** for off-chain indexing
- **Error handling** with custom errors for gas efficiency

## Deployment Strategy

### 1. Factory Deployment
Deploy the AssetTokenFactory first to manage all subsequent token deployments:

```solidity
AssetTokenFactory factory = new AssetTokenFactory(adminAddress);
```

### 2. Asset Token Deployment
Use the factory to deploy asset-specific tokens:

```solidity
// Deploy Real Estate Token
address retContract = factory.deployRealEstateToken(adminAddress);

// Deploy Gold Token  
address gldContract = factory.deployGoldToken(adminAddress);

// Deploy Vehicle Token
address vetContract = factory.deployVehicleToken(adminAddress);

// Deploy Art Token
address artContract = factory.deployArtToken(adminAddress);
```

### 3. Role Management
Set up proper roles for production:

```solidity
// Grant minter role to Fireblocks wallet
token.grantRole(MINTER_ROLE, fireblocksWalletAddress);

// Grant compliance role to compliance team
token.grantRole(COMPLIANCE_ROLE, complianceWalletAddress);
```

## Integration with Fireblocks

These contracts are designed to work seamlessly with Fireblocks:

1. **Fireblocks Wallet** should have the MINTER_ROLE for each token contract
2. **Contract calls** are initiated through Fireblocks API
3. **Multi-signature support** through Fireblocks governance
4. **Transaction monitoring** via Fireblocks webhooks

## Gas Optimization

The contracts implement several gas optimization techniques:
- **Custom errors** instead of require strings
- **Efficient data packing** in structs
- **Batch operations** where applicable
- **View functions** for off-chain data retrieval

## Upgradeability

While the contracts themselves are not upgradeable (for security), the factory pattern allows:
- **New contract versions** to be deployed alongside existing ones
- **Migration strategies** through the factory registry
- **Backward compatibility** maintenance

## Testing Requirements

Before production deployment, ensure comprehensive testing of:
- **Unit tests** for all contract functions
- **Integration tests** with Fireblocks API
- **Gas usage analysis** for cost optimization
- **Security audits** by reputable firms
- **Compliance review** by legal teams

## Next Steps

1. **Deploy to testnet** (Goerli/Sepolia) for integration testing
2. **Integrate with Fireblocks API** using testnet contracts
3. **End-to-end testing** with your application
4. **Security audit** before mainnet deployment
5. **Mainnet deployment** with proper ceremony

## Support

For questions about the smart contracts or deployment assistance, please refer to:
- OpenZeppelin documentation for inherited functionality
- Fireblocks API documentation for integration details
- Solidity documentation for language-specific questions