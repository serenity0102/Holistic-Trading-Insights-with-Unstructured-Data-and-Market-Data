import { api } from "@/shared/api/instance";
import { ConsensusListParams, ConsensusListResponse } from "./types";

export const consensusApi = {
  list: async (params?: ConsensusListParams): Promise<ConsensusListResponse> => {
    const { data } = await api.get<ConsensusListResponse>("/consensus", {
      params,
    });
    return data;
  },
}; 