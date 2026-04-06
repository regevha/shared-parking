export enum UserRole {
  USER = 'user',
  OWNER = 'owner',
  MANAGER = 'manager',
}

export enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum LotStatus {
  AVAILABLE = 'available',
  BLOCKED = 'blocked',
  UNOWNED = 'unowned',
  UNOWNED_BLOCKED = 'unowned-blocked',
}
