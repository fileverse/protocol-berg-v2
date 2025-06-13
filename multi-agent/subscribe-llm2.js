import dotenv from "dotenv";
import { Agent, PinataStorageProvider } from "@fileverse/agents";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import ollama from "ollama";

dotenv.config();

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

async function setupStorage() {
  // Create storage provider
  const storageProvider = new PinataStorageProvider({
    pinataJWT: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY,
  });

  // Initialize agent
  const agent = new Agent({
    chain: process.env.CHAIN, // required - options: gnosis, sepolia
    viemAccount: privateKeyToAccount(process.env.PRIVATE_KEY), // required - viem account instance
    pimlicoAPIKey: process.env.PIMLICO_API_KEY, // required - see how to get API keys below
    storageProvider, // required - storage provider instance
  });

  // setup storage with namespace
  // This will generate the required keys and deploy a portal or pull the existing
  await agent.setupStorage(process.env.NAMESPACE); // file is generated as the creds/${namespace}.json in the main directory
  return agent;
}

class LLM {
  constructor(modelName) {
    this.modelName = modelName;
  }

  async chat(input) {
    const response = await ollama.chat({
      model: this.modelName,
      messages: [{ role: "user", content: input }],
    });
    return response.message.content;
  }
}

async function setupLLMs(numberOfLLMs) {
  const llms = [];
  const models = ["qwen3:0.6b", "smollm:360m"];
  const filteredModels = models.slice(0, numberOfLLMs);
  for (let i = 0; i < filteredModels.length; i++) {
    const llm = new LLM(filteredModels[i]);
    llms.push(llm);
  }
  return llms;
}

async function responseToPrompt(llm, prompt) {
  const response = await llm.chat(prompt);
  return response;
}

async function main() {
  const agentStorage = await setupStorage();
  const llms = await setupLLMs(1);

  const unwatch = publicClient.watchContractEvent({
    address: agentStorage.portal,
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "uint256",
            name: "fileId",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "string",
            name: "metadataIPFSHash",
            type: "string",
          },
          {
            indexed: false,
            internalType: "string",
            name: "contentIPFSHash",
            type: "string",
          },
          {
            indexed: false,
            internalType: "string",
            name: "gateIPFSHash",
            type: "string",
          },
          {
            indexed: true,
            internalType: "address",
            name: "by",
            type: "address",
          },
        ],
        name: "AddedFile",
        type: "event",
      },
    ],
    onLogs: async (logs) => {
        const response = await fetch(`https://${process.env.PINATA_GATEWAY}/ipfs/${logs[0].args.contentIpfsHash.replace("ipfs://", "")}`).then(res => res.text());
        console.log(`Listened Response: ${response}`);
        const conversation = await responseToPrompt(llms[0], `Summarise this in 5 sentences: ${response}`);
        console.log(`Summarised Response: ${conversation}`);
        const { fileId } = await agentStorage.create(conversation);
        console.log(`File created: ${fileId}`);
        unwatch();
    },
  });
}

main();
