/**
 * Example usage of the FlowState multi-agent summarization system
 *
 * Run with: OPENROUTER_API_KEY=your_key npx ts-node src/example.ts
 */

import { parseTextContent, parseActions, createSummary } from "./parse";

// Mock document for testing (in real usage, this comes from the browser)
const mockReadabilityContent = {
  title: "Complete Your Purchase - Premium Subscription",
  content: `
    <h1>You're almost there!</h1>
    <p>Complete your purchase of the Premium Annual Subscription.</p>
    <p>Only 3 spots left at this price! Offer expires in 00:15:32</p>
    <h2>Order Summary</h2>
    <ul>
      <li>Premium Annual Subscription: $199.99/year</li>
      <li>Processing fee: $4.99</li>
      <li>Total: $204.98</li>
    </ul>
    <p>By clicking "Complete Purchase" you agree to our Terms of Service and 
    acknowledge that your subscription will automatically renew at the then-current 
    rate unless cancelled at least 24 hours before the renewal date. You may cancel 
    at any time by contacting support, but no refunds will be provided for partial 
    subscription periods. We may modify these terms at any time with 30 days notice.</p>
    <button>Complete Purchase</button>
    <a href="#">No thanks, I don't want to save money</a>
  `,
  textContent: `You're almost there! Complete your purchase of the Premium Annual Subscription.
    Only 3 spots left at this price! Offer expires in 00:15:32
    Order Summary: Premium Annual Subscription: $199.99/year, Processing fee: $4.99, Total: $204.98
    By clicking "Complete Purchase" you agree to our Terms of Service and acknowledge that your 
    subscription will automatically renew at the then-current rate unless cancelled at least 24 
    hours before the renewal date. You may cancel at any time by contacting support, but no refunds 
    will be provided for partial subscription periods. We may modify these terms at any time with 
    30 days notice.`,
  length: 800,
  excerpt: "Complete your Premium Annual Subscription purchase",
  byline: null,
  dir: "ltr",
  siteName: "Premium Service",
  lang: "en",
  publishedTime: null,
};

const mockActions = {
  actions: [
    {
      type: "button" as const,
      label: "Complete Purchase",
      disabled: false,
      importance: "primary" as const,
    },
    {
      type: "link" as const,
      label: "No thanks, I don't want to save money",
      href: "#",
      disabled: false,
      importance: "secondary" as const,
    },
  ],
  forms: [],
  navigationLinks: [],
  primaryActions: [
    {
      type: "button" as const,
      label: "Complete Purchase",
      disabled: false,
      importance: "primary" as const,
    },
  ],
};

async function main() {
  console.log("🚀 FlowState Multi-Agent Summarization Demo\n");
  console.log("Processing page: " + mockReadabilityContent.title);
  console.log("=".repeat(60) + "\n");

  try {
    const result = await createSummary(
      mockReadabilityContent,
      mockActions,
      "friendly",
      { verbose: true }, // Show communication log
    );

    console.log("\n" + "=".repeat(60));
    console.log("FINAL SUMMARY");
    console.log("=".repeat(60) + "\n");
    console.log(result.summary);

    if (result.errors.length > 0) {
      console.log("\n⚠️ Errors encountered:");
      result.errors.forEach((e) => console.log(`  - ${e}`));
    }

    console.log("\n" + "=".repeat(60));
    console.log(`Total agent interactions: ${result.communicationLog.length}`);
  } catch (error) {
    console.error("Failed to run summarization:", error);
  }
}

main();
