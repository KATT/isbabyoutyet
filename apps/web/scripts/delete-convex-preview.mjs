const API_ORIGIN = "https://api.convex.dev/v1";

const previewIdentifier = process.argv[2];
const token = process.env.CONVEX_MANAGEMENT_TOKEN;
const projectId = process.env.CONVEX_PROJECT_ID;

if (!previewIdentifier) {
  throw new Error("Usage: delete-convex-preview.mjs <preview-identifier>");
}
if (!token) {
  throw new Error("CONVEX_MANAGEMENT_TOKEN is not configured");
}
if (!projectId) {
  throw new Error("CONVEX_PROJECT_ID is not configured");
}

const headers = {
  Authorization: `Bearer ${token}`,
};
const listResponse = await fetch(
  `${API_ORIGIN}/projects/${encodeURIComponent(projectId)}/list_deployments`,
  { headers },
);
if (!listResponse.ok) {
  throw new Error(`Unable to list Convex deployments (${listResponse.status})`);
}

const deployments = await listResponse.json();
if (!Array.isArray(deployments)) {
  throw new Error("Convex returned an invalid deployment list");
}

const matchingDeployments = deployments.filter((deployment) => {
  if (!deployment || typeof deployment !== "object") {
    return false;
  }
  return (
    deployment.deploymentType === "preview" &&
    (deployment.previewIdentifier === previewIdentifier ||
      deployment.reference === `preview/${previewIdentifier}`)
  );
});

for (const deployment of matchingDeployments) {
  if (typeof deployment.name !== "string") {
    throw new Error("Convex returned a preview deployment without a name");
  }
  const deleteResponse = await fetch(
    `${API_ORIGIN}/deployments/${encodeURIComponent(deployment.name)}/delete`,
    {
      method: "POST",
      headers,
    },
  );
  if (!deleteResponse.ok) {
    throw new Error(
      `Unable to delete Convex deployment ${deployment.name} (${deleteResponse.status})`,
    );
  }
  console.log(`Deleted Convex preview ${deployment.name}`);
}

if (matchingDeployments.length === 0) {
  console.log(`Convex preview ${previewIdentifier} is already absent`);
}
