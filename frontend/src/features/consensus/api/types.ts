export interface ConsensusTask {
  sequence: number;
  taskCode: string;
  isStarted: boolean;
  isEnded: boolean;
  remark: string | null;
}

export interface ConsensusApproval {
  sequence: number;
  approvalUserId: string;
  status: string;
  remark: string | null;
}

export interface ConsensusMeta {
  amount: number;
  currency: string;
  description: string;
}

export interface ConsensusRequest {
  requestId: string;
  requestItem: string;
  status: string;
  isApproved: boolean;
  meta: ConsensusMeta;
  tasks: ConsensusTask[];
  approvals: ConsensusApproval[];
  createdAt: string;
}

export interface ConsensusListResponse {
  meta: {
    fetchedAt: string;
    count: number;
  };
  items: ConsensusRequest[];
}

export interface ConsensusListParams {
  start_date?: string;
  end_date?: string;
  limit?: number;
} 