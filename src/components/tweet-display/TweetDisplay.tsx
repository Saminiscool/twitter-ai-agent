import React, { Suspense } from 'react';
import { Tweet } from 'react-tweet';

interface TweetData {
  id: string;
  text: string;
  created_at: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

interface TweetDisplayProps {
  tweetsData: {
    type: 'tweets';
    count: number;
    tweets: TweetData[];
  };
}

const TweetSkeleton = () => (
  <div className="animate-pulse">
    <div className="bg-neutral-200 dark:bg-neutral-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-neutral-300 dark:bg-neutral-700 rounded-full"></div>
        <div className="space-y-2">
          <div className="w-32 h-4 bg-neutral-300 dark:bg-neutral-700 rounded"></div>
          <div className="w-24 h-3 bg-neutral-300 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="w-full h-4 bg-neutral-300 dark:bg-neutral-700 rounded"></div>
        <div className="w-3/4 h-4 bg-neutral-300 dark:bg-neutral-700 rounded"></div>
      </div>
      <div className="flex space-x-6">
        <div className="w-16 h-4 bg-neutral-300 dark:bg-neutral-700 rounded"></div>
        <div className="w-16 h-4 bg-neutral-300 dark:bg-neutral-700 rounded"></div>
        <div className="w-16 h-4 bg-neutral-300 dark:bg-neutral-700 rounded"></div>
      </div>
    </div>
  </div>
);

const SingleTweet: React.FC<{ id: string }> = ({ id }) => (
  <Suspense fallback={<TweetSkeleton />}>
    <div className="my-4">
      <Tweet id={id} />
    </div>
  </Suspense>
);

export const TweetDisplay: React.FC<TweetDisplayProps> = ({ tweetsData }) => {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Showing {tweetsData.count} recent tweet{tweetsData.count !== 1 ? 's' : ''}:
      </div>
      
      {tweetsData.tweets.map((tweet) => (
        <SingleTweet key={tweet.id} id={tweet.id} />
      ))}
    </div>
  );
};

