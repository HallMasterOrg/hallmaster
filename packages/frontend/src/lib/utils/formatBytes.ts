export default function formatBytes(bytes: number) {
  const suffixes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(1024)));
  return (!bytes && "0 Bytes") || (bytes / Math.pow(1024, i)).toPrecision(3) + " " + suffixes[i];
}
