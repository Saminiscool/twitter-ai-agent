/**
 * Tool definitions for the Twitter AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { unstable_scheduleSchema } from "agents/schedule";
import { getUserTweets as fetchUserTweets, postTweet } from "./twitter-api";

/**
 * Tweet composition tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
const composeTweet = tool({
  description: "compose and post a tweet to Twitter",
  parameters: z.object({ 
    content: z.string().max(280, "Tweet content must be 280 characters or less")
  })
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Get user tweets tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This fetches the user's recent tweets
 */
const getUserTweets = tool({
  description: "get the user's recent tweets from their timeline",
  parameters: z.object({ 
    count: z.number().min(1).max(10).default(5).describe("Number of tweets to retrieve (1-10)")
  }),
  execute: async ({ count }) => {
    console.log(`Getting ${count} recent tweets`);
    
    const result = await fetchUserTweets('252099921', count);
    
    if (!result.success) {
      return `Error fetching tweets: ${result.error}`;
    }

    if (!result.data?.data || result.data.data.length === 0) {
      return "No recent tweets found.";
    }

    const tweets = result.data.data.map((tweet: any) => ({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      replies: tweet.public_metrics?.reply_count || 0
    }));

    return `Here are your ${tweets.length} most recent tweets:\n\n${tweets.map((tweet, i) => 
      `${i + 1}. "${tweet.text}"\n   📅 ${new Date(tweet.created_at).toLocaleDateString()}\n   ❤️ ${tweet.likes} | 🔄 ${tweet.retweets} | 💬 ${tweet.replies}\n`
    ).join('\n')}`;
  }
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  parameters: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  parameters: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  parameters: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  composeTweet,
  getUserTweets,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask
};

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 * NOTE: keys below should match toolsRequiringConfirmation in app.tsx
 */
export const executions = {
  composeTweet: async ({ content }: { content: string }) => {
    console.log(`Posting tweet: ${content}`);
    
    const result = await postTweet(content);
    
    if (!result.success) {
      return `❌ Error posting tweet: ${result.error}`;
    }

    return `✅ Tweet posted successfully!\n\nTweet ID: ${result.data.data.id}\nContent: "${content}"\n\nYou can view it at: https://twitter.com/fayazara/status/${result.data.data.id}`;
  }
};
