import { Cluster } from '../prisma/generated/client.js';

export declare interface HallmasterHypervisor {
  start(bot: Bot, cluster: Cluster): Promise<void>;

  stop(bot: Bot, cluster: Cluster): Promise<void>;

  restart(bot: Bot, cluster: Cluster): Promise<void>;
}
