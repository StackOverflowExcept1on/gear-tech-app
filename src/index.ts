import { Context, Probot } from "probot";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export = (app: Probot) => {
  app.on("issue_comment.created", async (context) => {
    if (context.isBot) {
      return;
    }

    const { comment, issue } = context.payload;
    if (!issue.pull_request) {
      return;
    }

    const { data: pull_request } = await context.octokit.pulls.get(
      context.pullRequest()
    );

    if (!(pull_request.state == "open" && pull_request.user)) {
      return;
    }

    try {
      await context.octokit.orgs.checkMembershipForUser({
        org: "gear-tech",
        username: pull_request.user.login,
      });
    } catch (err) {
      return;
    }

    const body = comment.body;
    if (body.startsWith("/generate-weights")) {
      await handleGenerateWeightsCommand(context, pull_request);
    }
  });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const handleGenerateWeightsCommand = async (
  context: Context<"issue_comment.created">,
  pull_request: RestEndpointMethodTypes["pulls"]["get"]["response"]["data"]
) => {
  const workflow_id = "benchmarks.yml";
  const head_sha = pull_request.head.sha;

  await context.octokit.actions.createWorkflowDispatch(
    context.repo({
      workflow_id,
      ref: pull_request.head.ref,
      inputs: {
        "change-type": "commit",
      },
    })
  );

  await sleep(10_000);

  const {
    data: { workflow_runs },
  } = await context.octokit.actions.listWorkflowRuns(
    context.repo({
      workflow_id,
      head_sha,
    })
  );

  const workflow_run = workflow_runs[0];

  await context.octokit.issues.createComment(
    context.issue({
      body: [
        "Benchmarks have been run and will be added as a commit to your branch.",
        `Tracking URL: ${workflow_run.html_url}`,
      ].join("\n"),
    })
  );
};
