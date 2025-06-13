import dotenv from "dotenv";
import { Agent, PinataStorageProvider } from "@fileverse/agents";
import { privateKeyToAccount } from "viem/accounts";
import ollama from "ollama";

dotenv.config();

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
  const llms = await setupLLMs(2);
  const { fileId: memoryFileId } = await agentStorage.create('# Agent Memory');
  const memoryFile = await agentStorage.getFile(memoryFileId);
  console.log(`Memory file: ${memoryFile.contentIpfsHash}`);
  const memory = await fetch(`https://${process.env.PINATA_GATEWAY}/ipfs/${memoryFile.contentIpfsHash.replace("ipfs://", "")}`).then(res => res.text());
  console.log(`Memory: ${memory}`);

  const prompt = "How to make tomato soup?";
  
  console.log("Prompt:", prompt);
  const conversation = await responseToPrompt(llms[0], prompt);
  
  // Print the conversation
  const conversationLog = [];
  conversationLog.push("\nConversation Log:\n");
  conversationLog.push(conversation);
  conversationLog.push("\n");
  const { fileId } = await agentStorage.create(conversationLog.join("\n"));
  console.log(`Log created: ${fileId}`);

  const conversationWithMemory = await responseToPrompt(llms[1], `Summarise the conversation: ${conversationLog.join("\n")}`);
  await agentStorage.edit(memoryFileId, memory + "\n\n" + conversationWithMemory);
  const updatedMemoryFile = await agentStorage.getFile(memoryFileId);
  console.log(`Memory file: ${updatedMemoryFile.contentIpfsHash}`);
  const updatedMemory = await fetch(`https://${process.env.PINATA_GATEWAY}/ipfs/${updatedMemoryFile.contentIpfsHash.replace("ipfs://", "")}`).then(res => res.text());
  console.log(`Memory: ${updatedMemory}`);
}

main();
