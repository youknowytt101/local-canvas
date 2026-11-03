// Cosmos' buildUserClusterRouteParams / buildSubClusterRouteParams (module 1895): the nested params that open a collection
// from outside its tab's stack; initial: false keeps the tab's root under it. A stack here has the two routes itself (Cosmos
// has them in a USER_CLUSTER_ROOT stack of their own). Cosmos' followerId and ownerAvatarUrl are not needed: a collection
// is read by its id alone.
import { Routes } from '../../navigation/routes';

export type UserClusterParams = {
  clusterId: string;
  subClusterName?: string; // shown until the collection has loaded
  parentClusterName?: string;
};

export const buildUserClusterRouteParams = (params: UserClusterParams) =>
  ({ screen: Routes.USER_CLUSTER, initial: false, params }) as const;

export const buildSubClusterRouteParams = (params: UserClusterParams) =>
  ({ screen: Routes.SUB_CLUSTER, initial: false, params }) as const;
