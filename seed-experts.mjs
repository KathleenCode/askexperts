// Run this once locally (with your AWS credentials configured) to populate the Experts table.
// Usage: node seed-experts.mjs

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const EXPERTS_TABLE = process.env.EXPERTS_TABLE || "AskAnExpert-Experts";

// Replace these with real names/emails before deploying — SES sandbox mode
// will only deliver to verified addresses, so use addresses you control for testing.
const experts = [
  { expertId: "1", name: "Priya Nandan", email: "REPLACE_ME@example.com", specialty: "Networking", available: true },
  { expertId: "2", name: "Marcus Webb", email: "REPLACE_ME@example.com", specialty: "Security", available: true },
  { expertId: "3", name: "Elena Torres", email: "REPLACE_ME@example.com", specialty: "Cost", available: true },
  { expertId: "4", name: "Jamal Fischer", email: "REPLACE_ME@example.com", specialty: "Serverless", available: true },
  { expertId: "5", name: "Sena Okafor", email: "REPLACE_ME@example.com", specialty: "Data", available: true },
  { expertId: "6", name: "Tom Reyes", email: "REPLACE_ME@example.com", specialty: "General", available: true }
];

async function seed() {
  for (const expert of experts) {
    await ddb.send(new PutCommand({ TableName: EXPERTS_TABLE, Item: expert }));
    console.log(`Seeded: ${expert.name} (${expert.specialty})`);
  }
  console.log("Done.");
}

seed().catch(console.error);