import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { randomUUID } from "crypto";

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const ses = new SESv2Client({});

const EXPERTS_TABLE = process.env.EXPERTS_TABLE || "AskAnExpert-Experts";
const REQUESTS_TABLE = process.env.REQUESTS_TABLE || "AskAnExpert-Requests";
const SENDER_EMAIL = process.env.SENDER_EMAIL;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
  "Content-Type": "application/json"
};

function genTicketId() {
  return "TCK-" + randomUUID().slice(0, 6).toUpperCase();
}

async function findAvailableExpert(category) {
  const result = await ddb.send(new ScanCommand({
    TableName: EXPERTS_TABLE,
    FilterExpression: "specialty = :cat AND available = :avail",
    ExpressionAttributeValues: { ":cat": category, ":avail": true }
  }));

  const matches = result.Items || [];
  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}

function buildAskerEmail(expertName, category, urgency, ticketId) {
  return `
    <div style="font-family:Georgia,serif;max-width:600px;">
      <h2 style="color:#3E2723;">You're connected — ${ticketId}</h2>
      <p>Your ${category} question has been routed to <strong>${expertName}</strong>.</p>
      <p>Urgency: <strong>${urgency}</strong>. They'll be in touch based on that timeline.</p>
    </div>`;
}

function buildExpertEmail(question, askerEmail, category, urgency, ticketId) {
  return `
    <div style="font-family:Georgia,serif;max-width:600px;">
      <h2 style="color:#3E2723;">New ${category} question — ${ticketId}</h2>
      <p><strong>From:</strong> ${askerEmail}</p>
      <p><strong>Urgency:</strong> ${urgency}</p>
      <p><strong>Question:</strong><br/>${question}</p>
    </div>`;
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { question, category, urgency, email } = body;

    if (!question || !category || !email) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing 'question', 'category', or 'email' in request body." })
      };
    }

    const expert = await findAvailableExpert(category);

    if (!expert) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `No available expert found for category '${category}'.` })
      };
    }

    const ticketId = genTicketId();
    const urgencyValue = urgency || "Instant";

    await ddb.send(new PutCommand({
      TableName: REQUESTS_TABLE,
      Item: {
        ticketId,
        question,
        category,
        urgency: urgencyValue,
        askerEmail: email,
        matchedExpertName: expert.name,
        matchedExpertEmail: expert.email,
        status: "matched",
        createdAt: new Date().toISOString()
      }
    }));

    await ses.send(new SendEmailCommand({
      FromEmailAddress: SENDER_EMAIL,
      Destination: { ToAddresses: [email] },
      Content: {
        Simple: {
          Subject: { Data: `You're connected — ${ticketId}` },
          Body: { Html: { Data: buildAskerEmail(expert.name, category, urgencyValue, ticketId) } }
        }
      }
    }));

    await ses.send(new SendEmailCommand({
      FromEmailAddress: SENDER_EMAIL,
      Destination: { ToAddresses: [expert.email] },
      Content: {
        Simple: {
          Subject: { Data: `New ${category} question — ${ticketId}` },
          Body: { Html: { Data: buildExpertEmail(question, email, category, urgencyValue, ticketId) } }
        }
      }
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ticketId,
        matchedExpertName: expert.name,
        specialty: expert.specialty,
        urgency: urgencyValue
      })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || "Internal error" })
    };
  }
};