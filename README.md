# AskAnExpert — Deployment Guide

Architecture: **Browser (Amplify) → Lambda Function URL → DynamoDB (match lookup + ticket write) → Amazon SES (two emails)**


## 1. Create the DynamoDB tables

Console → **DynamoDB** → **Create table**, twice:

**Table 1: `AskAnExpert-Experts`**
- Partition key: `expertId` (String)

**Table 2: `AskAnExpert-Requests`**
- Partition key: `ticketId` (String)

Leave all other settings default (on-demand capacity mode is fine and free-tier friendly for this volume).

## 2. Seed the Experts table

1. Open `lambda/seed-experts.mjs` and replace every `REPLACE_ME@example.com` with real email addresses you control (or the same one repeated — fine for testing).
2. Locally, with AWS credentials configured (`aws configure`):
```bash
   cd lambda
   npm install
   node seed-experts.mjs
```
3. Confirm in the DynamoDB console that `AskAnExpert-Experts` now has 6 items.

**Note:** if you don't want to set up local AWS credentials, you can instead add the 6 expert items directly in the DynamoDB console (**Explore table items → Create item → JSON view**), or run the seed logic as a one-off Lambda invoked once via the Test tab. Either approach works equally well.

## 3. Verify SES identities

SES console → **Verified identities** →
