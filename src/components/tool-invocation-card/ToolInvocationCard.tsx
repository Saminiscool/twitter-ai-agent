import { useState } from "react";
import {
  CaretDownIcon,
  CheckCircleIcon,
  TwitterLogoIcon,
  CalendarPlusIcon,
  ListBulletsIcon,
  TrashIcon,
  PencilIcon
} from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Tooltip } from "@/components/tooltip/Tooltip";
import { APPROVAL } from "@/shared";
import { TextShimmer } from "../text-shimmer";

const toolDisplayNames: Record<string, string> = {
  composeTweet: "Composing and posting tweet",
  getUserTweets: "Fetching recent tweets",
  scheduleTask: "Scheduling task",
  getScheduledTasks: "Getting scheduled tasks",
  cancelScheduledTask: "Canceling scheduled task"
};

const toolIcons: Record<string, React.ReactNode> = {
  composeTweet: (
    <PencilIcon weight="duotone" size={16} className="text-[#F48120]" />
  ),
  getUserTweets: (
    <TwitterLogoIcon weight="duotone" size={16} className="text-[#F48120]" />
  ),
  scheduleTask: (
    <CalendarPlusIcon weight="duotone" size={16} className="text-[#F48120]" />
  ),
  getScheduledTasks: (
    <ListBulletsIcon weight="duotone" size={16} className="text-[#F48120]" />
  ),
  cancelScheduledTask: (
    <TrashIcon weight="duotone" size={16} className="text-[#F48120]" />
  )
};

interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  state: "call" | "result" | "partial-call";
  step?: number;
  args: Record<string, unknown>;
  result?: {
    content?: Array<{ type: string; text: string }>;
  };
}

interface ToolInvocationCardProps {
  toolInvocation: ToolInvocation;
  toolCallId: string;
  needsConfirmation: boolean;
  addToolResult: (args: { toolCallId: string; result: any }) => void;
}

export function ToolInvocationCard({
  toolInvocation,
  toolCallId,
  needsConfirmation,
  addToolResult
}: ToolInvocationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card
      className={`p-4 my-1 w-full max-w-[500px] rounded-lg bg-neutral-200 dark:bg-neutral-900 ${
        needsConfirmation ? "" : "border-[#F48120]/30"
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 cursor-pointer"
      >
        <div
          className={`${needsConfirmation ? "bg-[#F48120]/10" : "bg-[#F48120]/5"} p-1.5 rounded-full flex-shrink-0`}
        >
          {toolIcons[toolInvocation.toolName] || (
            <TwitterLogoIcon
              weight="duotone"
              size={16}
              className="text-[#F48120]"
            />
          )}
        </div>
        <h4 className="font-medium flex items-center gap-2 flex-1 text-left">
          {toolInvocation.state === "result" ? (
            <span>
              {toolDisplayNames[toolInvocation.toolName] ||
                toolInvocation.toolName}
            </span>
          ) : (
            <TextShimmer>
              {toolDisplayNames[toolInvocation.toolName] ||
                toolInvocation.toolName}
            </TextShimmer>
          )}
          {toolInvocation.state === "result" && (
            <div className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircleIcon weight="duotone" size={16} /> Completed
            </div>
          )}
        </h4>
        <CaretDownIcon
          weight="duotone"
          size={16}
          className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`transition-all duration-200 ${isExpanded ? "max-h-[200px] opacity-100 mt-3" : "max-h-0 opacity-0 overflow-hidden"}`}
      >
        <div
          className="overflow-y-auto"
          style={{ maxHeight: isExpanded ? "180px" : "0px" }}
        >
          <div className="mb-3">
            <h5 className="text-xs font-medium mb-1 text-muted-foreground">
              Arguments:
            </h5>
            <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px]">
              {JSON.stringify(toolInvocation.args, null, 2)}
            </pre>
          </div>

          {needsConfirmation && toolInvocation.state === "call" && (
            <div className="flex gap-2 justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  addToolResult({
                    toolCallId,
                    result: APPROVAL.NO
                  })
                }
              >
                Reject
              </Button>
              <Tooltip content={"Accept action"}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    addToolResult({
                      toolCallId,
                      result: APPROVAL.YES
                    })
                  }
                >
                  Approve
                </Button>
              </Tooltip>
            </div>
          )}

          {!needsConfirmation && toolInvocation.state === "result" && (
            <div className="mt-3 border-t border-[#F48120]/10 pt-3">
              <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                Result:
              </h5>
              <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px]">
                {(() => {
                  const result = toolInvocation.result;
                  if (typeof result === "object" && result.content) {
                    return result.content
                      .map((item: { type: string; text: string }) => {
                        if (
                          item.type === "text" &&
                          item.text.startsWith("\n~ Page URL:")
                        ) {
                          const lines = item.text.split("\n").filter(Boolean);
                          return lines
                            .map(
                              (line: string) => `- ${line.replace("\n~ ", "")}`
                            )
                            .join("\n");
                        }
                        return item.text;
                      })
                      .join("\n");
                  }
                  return JSON.stringify(result, null, 2);
                })()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
