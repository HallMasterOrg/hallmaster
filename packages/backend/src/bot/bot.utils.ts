export function formatDockerImage(
  dockerImage: {
    serverName: string;
    image: string;
    tag: string;
    username: string | null;
  } | null,
) {
  if (dockerImage === null) {
    throw new Error('Docker image is required but was not found.');
  }

  return {
    image: `${dockerImage.serverName}/${dockerImage.image}:${dockerImage.tag}`,
    username: dockerImage.username,
  };
}
