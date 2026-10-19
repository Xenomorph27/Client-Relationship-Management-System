import { makeResource } from './client.js'

const resource = makeResource('campaigns', 'Campaign')

export const listCampaigns = resource.list
export const getCampaign = resource.get
export const createCampaign = resource.create
export const updateCampaign = resource.update
export const deleteCampaign = resource.remove
