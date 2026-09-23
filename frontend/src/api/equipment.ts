import request from '@/utils/request'

export interface Equipment {
  id?: number
  equipmentCode: string
  equipmentName: string
  equipmentType: string
  model: string
  installLocation: string
  wellName: string
  runningHours: number
  status: string
  lastMaintenanceDate: string
  nextMaintenanceDate: string
  remark?: string
}

export interface MaintenanceRecord {
  id?: number
  equipmentId: number
  equipmentName: string
  equipmentCode: string
  maintenanceType: string
  maintenanceDate: string
  maintenancePerson: string
  maintenanceContent: string
  maintenanceResult: string
  cost?: number
  remark?: string
  createdAt?: string
}

/** 计划状态：待执行 / 已完成 / 已取消 */
export type PlanStatus = 'pending' | 'completed' | 'cancelled'

/** 逾期风险等级：已逾期 / 7天内到期 / 30天内到期 / 正常 */
export type RiskLevel = 'overdue' | 'soon' | 'upcoming' | 'normal'

/** 保养计划 */
export interface MaintenancePlan {
  id: number
  equipmentId: number
  equipmentName: string
  equipmentCode: string
  equipmentType: string
  maintenanceType: string
  /** 计划保养日期 YYYY-MM-DD */
  plannedDate: string
  /** 负责人 */
  assignee: string
  /** 保养周期（天），0 表示一次性保养（故障/紧急维修） */
  cycleDays: number
  content: string
  status: PlanStatus
  remark?: string
  createdAt: string
  completedAt?: string
}

/** 批量生成计划入参（plannedDate 为统一日期；items 可按设备指定日期） */
export interface GeneratePlansParams {
  equipmentIds: number[]
  maintenanceType: string
  plannedDate: string
  assignee: string
  cycleDays: number
  content: string
  remark?: string
  /** 按设备指定计划日期（“按各设备下次保养日期”模式）；优先级高于 plannedDate */
  items?: { equipmentId: number; plannedDate: string }[]
}

/** 单个计划的生成/保存结果（用于说明跳过或失败原因） */
export interface PlanSaveResult {
  success: boolean
  equipmentName: string
  plannedDate: string
  reason?: string
}

/** 批量调整入参：负责人与周期二选一或同时调整 */
export interface BatchAdjustParams {
  planIds: number[]
  assignee?: string
  cycleDays?: number
}

/** 完成维护（登记）入参 */
export interface CompleteMaintenanceParams {
  equipmentId: number
  maintenanceType: string
  maintenanceDate: string
  maintenancePerson: string
  maintenanceContent: string
  maintenanceResult: string
  cost: number
  nextMaintenanceDate: string
  remark?: string
  /** 从计划完成时传入计划 id，会同时把计划置为已完成 */
  planId?: number
}

export interface EquipmentQuery {
  equipmentName?: string
  equipmentType?: string
  status?: string
  startDate?: string
  endDate?: string
  pageNum?: number
  pageSize?: number
}

export const getEquipmentList = (params: EquipmentQuery) => {
  return request({
    url: '/api/equipment/list',
    method: 'get',
    params
  })
}

export const getEquipmentById = (id: number) => {
  return request({
    url: `/api/equipment/${id}`,
    method: 'get'
  })
}

export const createEquipment = (data: Equipment) => {
  return request({
    url: '/api/equipment',
    method: 'post',
    data
  })
}

export const updateEquipment = (data: Equipment) => {
  return request({
    url: '/api/equipment',
    method: 'put',
    data
  })
}

export const deleteEquipment = (id: number) => {
  return request({
    url: `/api/equipment/${id}`,
    method: 'delete'
  })
}

export const getMaintenanceRecords = (equipmentId?: number) => {
  return request({
    url: '/api/maintenance/list',
    method: 'get',
    params: { equipmentId }
  })
}

export const createMaintenanceRecord = (data: MaintenanceRecord) => {
  return request({
    url: '/api/maintenance',
    method: 'post',
    data
  })
}

export const getMaintenanceStats = () => {
  return request({
    url: '/api/maintenance/stats',
    method: 'get'
  })
}

export const getOverdueMaintenance = () => {
  return request({
    url: '/api/maintenance/overdue',
    method: 'get'
  })
}

export const getEquipmentTypeOptions = () => {
  return request({
    url: '/api/equipment/types',
    method: 'get'
  })
}

export const getStatusOptions = () => {
  return request({
    url: '/api/equipment/statuses',
    method: 'get'
  })
}

// ---------------- 保养计划 ----------------

export const getMaintenancePlans = (params?: { status?: PlanStatus; equipmentId?: number }) => {
  return request({
    url: '/api/maintenance/plans',
    method: 'get',
    params
  })
}

export const generateMaintenancePlans = (data: GeneratePlansParams) => {
  return request({
    url: '/api/maintenance/plans/generate',
    method: 'post',
    data
  })
}

export const updateMaintenancePlan = (data: Partial<MaintenancePlan> & { id: number }) => {
  return request({
    url: '/api/maintenance/plans',
    method: 'put',
    data
  })
}

export const batchAdjustPlans = (data: BatchAdjustParams) => {
  return request({
    url: '/api/maintenance/plans/batch-adjust',
    method: 'post',
    data
  })
}

export const completeMaintenance = (data: CompleteMaintenanceParams) => {
  return request({
    url: '/api/maintenance/complete',
    method: 'post',
    data
  })
}

export const cancelMaintenancePlan = (id: number) => {
  return request({
    url: `/api/maintenance/plans/${id}/cancel`,
    method: 'post'
  })
}
