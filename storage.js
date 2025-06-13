import dotenv from 'dotenv';
import { Agent, PinataStorageProvider } from '@fileverse/agents';
import { privateKeyToAccount } from 'viem/accounts';

dotenv.config();

// Create storage provider
const storageProvider = new PinataStorageProvider({
  pinataJWT: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY
});

// Initialize agent
const agentStorage = new Agent({
  chain: process.env.CHAIN, // required - options: gnosis, sepolia
  viemAccount: privateKeyToAccount(process.env.PRIVATE_KEY), // required - viem account instance
  pimlicoAPIKey: process.env.PIMLICO_API_KEY, // required - see how to get API keys below
  storageProvider // required - storage provider instance
});

// setup storage with namespace
// This will generate the required keys and deploy a portal or pull the existing 
await agentStorage.setupStorage(process.env.NAMESPACE); // file is generated as the creds/${namespace}.json in the main directory

const latestBlockNumber = await agentStorage.getBlockNumber();
console.log(`Latest block number: ${latestBlockNumber}`);

// create a new file 
const file = await agentStorage.create('Hello World');
console.log(`File created: ${file}`);

// get the file
const fileData = await agentStorage.getFile(file.fileId);
console.log(`File: ${fileData.contentIpfsHash}`);

// update the file
const updatedFile = await agentStorage.update(file.fileId, 'Hello World 2');
console.log(`File updated: ${updatedFile.contentIpfsHash}`);
