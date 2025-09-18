# Overview

This is a comprehensive Real World Asset (RWA) tokenization platform that enables users to pledge physical assets and convert them into blockchain-based digital tokens. The system provides a complete end-to-end solution for asset tokenization, including KYC/AML compliance, legal documentation, smart contract integration, and liquidity management. The platform focuses on tokenizing various asset categories including real estate, commodities, bonds, equipment, and inventory through a multi-token architecture.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and hot reloading
- **UI Library**: Shadcn/UI with Radix UI primitives for accessible, customizable components
- **Styling**: Tailwind CSS with custom design tokens for professional tokenization portal theming
- **State Management**: React hooks and context for authentication, with TanStack Query for server state
- **Routing**: React Router for client-side navigation with protected routes

## Backend Architecture
- **Authentication**: Supabase Auth with profile management and role-based access control (RBAC)
- **Database**: PostgreSQL via Neon with Drizzle ORM for type-safe database operations
- **API Layer**: Supabase functions for serverless backend operations
- **Smart Contracts**: Hardhat development environment with OpenZeppelin contracts for ERC20 tokens and upgradeable patterns

## Multi-Token Smart Contract System
- **Core Contract**: SimpleRwaBackedStablecoin.sol deployed to Sepolia testnet at 0x7a408cadbC99EE39A0E01f4Cdb10139601163407
- **Category Tokens**: Each asset type maps to specific USD-backed tokens (RUSD, CUSD, BUSD, EUSD, IUSD, OUSD)
- **Factory Pattern**: Automated deployment and management of asset-specific token contracts
- **Pledge System**: NFT-based pledge verification with escrow functionality
- **Deployment Status**: Successfully deployed September 18, 2025 with full Etherscan verification
- **Live Token Addresses**:
  - RUSD (Real Estate): 0x1297F2046FcC526A96a8667E972B009e55f8a845
  - CUSD (Commodities): 0x838d4B07d2A8b14Ce631808E911a51D537c462E7
  - BUSD (Bonds): 0x85635cd6c1Aa4143b263612448941E343DA296e3
  - EUSD (Equipment): 0x2FdF5CaFcE00Ed5663a9ade6914F672d9A055292
  - IUSD (Inventory): 0x798993EC1fCFbA78f8078169c65231D65A402643
  - OUSD (Other): 0x633725f24077E61Ad9FF4abeA66BBB6058597719

## Data Storage Solutions
- **Primary Database**: PostgreSQL with structured tables for profiles, pledges, agreements, and audit logs
- **Schema Management**: Drizzle ORM with type-safe migrations and relationships
- **Document Storage**: Hash-based document verification with metadata storage
- **Audit Trails**: Comprehensive logging system for administrative actions and user activities

## Authentication and Authorization
- **Multi-tier Access**: User, admin, and super-admin roles with granular permissions
- **KYC/AML Integration**: Automated compliance checking with status tracking
- **Session Management**: Secure JWT-based authentication with automatic renewal
- **Admin Privileges**: Special access controls for pledge approval, token minting, and system management

# External Dependencies

## Blockchain Infrastructure
- **Fireblocks**: Enterprise-grade custody solution for secure asset management and transaction signing
- **Ethereum/Polygon**: Primary blockchain networks for smart contract deployment
- **Infura/Alchemy**: Blockchain node infrastructure for reliable network connectivity
- **Hardhat**: Smart contract development, testing, and deployment framework

## Database and Backend Services
- **Neon Database**: Serverless PostgreSQL hosting with automatic scaling
- **Supabase**: Backend-as-a-Service for authentication, real-time features, and edge functions
- **Drizzle Kit**: Database migration tools and schema management

## Form and Compliance Management
- **Cognito Forms**: Embedded legal document collection and digital signature workflows
- **KYC/AML Providers**: Integration points for automated compliance verification
- **Document Management**: Secure document upload, verification, and storage systems

## Development and Deployment
- **Vite**: Fast build tool and development server with hot module replacement
- **TypeScript**: Type safety across the entire application stack
- **ESLint/Prettier**: Code quality and formatting standards
- **Lovable Platform**: Primary development and deployment environment