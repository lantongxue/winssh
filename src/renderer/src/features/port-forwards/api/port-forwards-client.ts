import { getWinsshDomainClient } from '@/features/shared/api/winssh-client'

export const portForwardsClient = getWinsshDomainClient('portForwards')
