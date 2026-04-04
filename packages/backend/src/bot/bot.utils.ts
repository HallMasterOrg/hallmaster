export function formatDockerImage(dockerImage: {
  serverName: string;
  image: string;
  tag: string;
  username: string | null;
}) {
  return {
    image: `${dockerImage.serverName}/${dockerImage.image}:${dockerImage.tag}`,
    username: dockerImage.username,
  };
}
