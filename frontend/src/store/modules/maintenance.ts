import { defineStore } from 'pinia'
import type {
  MaintenanceRecord,
  MaintenancePlan,
  GeneratePlansParams,
  BatchAdjustParams,
  CompleteMaintenanceParams,
  PlanSaveResult,
  RiskLevel
} from '@/api/equipment'

// 持久化 key：带版本号，避免旧演示数据（2024 年的写死日期）污染
const STORAGE_KEY = 'wlms_maintenance_store_v2'

// ---------------- 日期工具 ----------------

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 以本地时区格式化 YYYY-MM-DD */
export const formatDate = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

export const todayStr = (): string => formatDate(new Date())

/** 在基准日期上加减天数 */
export const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

/** 本月月初 */
const monthStart = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
}

const diffDays = (a: string, b: string): number => {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.round((da - db) / (24 * 60 * 60 * 1000))
}

// ---------------- 保养类型 / 风险 ----------------

export const MAINTENANCE_TYPES = ['常规维护', '定期保养', '故障维修', '紧急维修']

/** 各保养类型默认周期（天），0 = 一次性 */
export const DEFAULT_CYCLE: Record<string, number> = {
  常规维护: 30,
  定期保养: 90,
  故障维修: 0,
  紧急维修: 0
}

export const DEFAULT_PLAN_CONTENT: Record<string, string> = {
  常规维护: '检查润滑、紧固部件、清洁设备并记录运行参数',
  定期保养: '更换易损件、全面检测、性能校准',
  故障维修: '排查故障点、修复或更换故障部件、复测验证',
  紧急维修: '紧急停机抢修，排除安全隐患后恢复运行'
}

export const RISK_META: Record<RiskLevel, { label: string; tagType: 'danger' | 'warning' | 'primary' | 'info'; timelineType: 'danger' | 'warning' | 'primary' | 'info' }> = {
  overdue: { label: '已逾期', tagType: 'danger', timelineType: 'danger' },
  soon: { label: '7天内到期', tagType: 'warning', timelineType: 'warning' },
  upcoming: { label: '30天内到期', tagType: 'primary', timelineType: 'primary' },
  normal: { label: '正常', tagType: 'info', timelineType: 'info' }
}

/** 按计划日期与今天的差值计算逾期风险（仅对待执行计划有意义） */
export const getRiskLevel = (plannedDate: string): RiskLevel => {
  const gap = diffDays(plannedDate, todayStr())
  if (gap < 0) return 'overdue'
  if (gap <= 7) return 'soon'
  if (gap <= 30) return 'upcoming'
  return 'normal'
}

/** 备选负责人（演示数据中出现过的维护人员 + 常用人员） */
export const DEFAULT_ASSIGNEES = ['张三', '李四', '王五', '赵六', '钱七']

// ---------------- 初始种子数据（相对今天，保证逾期/临期/正常都有演示） ----------------

const T = todayStr()

const buildSeedEquipment = () => [
  { id: 1, equipmentCode: 'PUMP-001', equipmentName: '抽油机A1', equipmentType: '抽油机', model: 'CYJ12-4.8-73HB', installLocation: 'A井场1号', wellName: 'A-01井', runningHours: 8520, status: '运行中', lastMaintenanceDate: addDays(T, -20), nextMaintenanceDate: addDays(T, 10) },
  { id: 2, equipmentCode: 'PUMP-002', equipmentName: '抽油机B3', equipmentType: '抽油机', model: 'CYJ10-3-53HB', installLocation: 'B井场3号', wellName: 'B-03井', runningHours: 6350, status: '运行中', lastMaintenanceDate: addDays(T, -3), nextMaintenanceDate: addDays(T, 5) },
  { id: 3, equipmentCode: 'VALVE-001', equipmentName: '阀门组C2', equipmentType: '阀门', model: 'Z41H-16C DN100', installLocation: 'C井场2号', wellName: 'C-02井', runningHours: 12500, status: '待维护', lastMaintenanceDate: addDays(T, -45), nextMaintenanceDate: addDays(T, -12) },
  { id: 4, equipmentCode: 'SENSOR-001', equipmentName: '压力传感器D5', equipmentType: '传感器', model: 'PT-300', installLocation: 'D井场5号', wellName: 'D-05井', runningHours: 3200, status: '故障', lastMaintenanceDate: addDays(T, -80), nextMaintenanceDate: addDays(T, -3) },
  { id: 5, equipmentCode: 'MOTOR-001', equipmentName: '电机E1', equipmentType: '电机', model: 'Y2-315M-4', installLocation: 'E井场1号', wellName: 'E-01井', runningHours: 9800, status: '运行中', lastMaintenanceDate: addDays(T, -40), nextMaintenanceDate: addDays(T, 45) },
  { id: 6, equipmentCode: 'PUMP-003', equipmentName: '抽油机C1', equipmentType: '抽油机', model: 'CYJ12-4.8-73HB', installLocation: 'C井场1号', wellName: 'C-01井', runningHours: 7200, status: '待维护', lastMaintenanceDate: addDays(T, -70), nextMaintenanceDate: addDays(T, -25) },
  { id: 7, equipmentCode: 'VALVE-002', equipmentName: '阀门组A3', equipmentType: '阀门', model: 'Z41H-16C DN80', installLocation: 'A井场3号', wellName: 'A-03井', runningHours: 9500, status: '运行中', lastMaintenanceDate: addDays(T, -10), nextMaintenanceDate: addDays(T, 20) }
]

const buildSeedRecords = (): MaintenanceRecord[] => [
  { id: 1, equipmentId: 1, equipmentName: '抽油机A1', equipmentCode: 'PUMP-001', maintenanceType: '常规维护', maintenanceDate: addDays(T, -20), maintenancePerson: '张三', maintenanceContent: '检查润滑油、紧固螺丝、清洁设备表面', maintenanceResult: '完成', cost: 500, remark: '运行正常', createdAt: new Date().toISOString() },
  { id: 2, equipmentId: 1, equipmentName: '抽油机A1', equipmentCode: 'PUMP-001', maintenanceType: '定期保养', maintenanceDate: addDays(T, -110), maintenancePerson: '李四', maintenanceContent: '更换油封、检查皮带张力', maintenanceResult: '完成', cost: 1200, remark: '皮带磨损正常', createdAt: new Date().toISOString() },
  { id: 3, equipmentId: 3, equipmentName: '阀门组C2', equipmentCode: 'VALVE-001', maintenanceType: '常规维护', maintenanceDate: addDays(T, -45), maintenancePerson: '王五', maintenanceContent: '阀门开关测试、密封检查', maintenanceResult: '完成', cost: 200, remark: '一切正常', createdAt: new Date().toISOString() },
  { id: 4, equipmentId: 4, equipmentName: '压力传感器D5', equipmentCode: 'SENSOR-001', maintenanceType: '故障维修', maintenanceDate: addDays(T, -80), maintenancePerson: '赵六', maintenanceContent: '更换失灵压力探头，重新标定量程', maintenanceResult: '完成', cost: 800, remark: '已复测', createdAt: new Date().toISOString() },
  { id: 5, equipmentId: 7, equipmentName: '阀门组A3', equipmentCode: 'VALVE-002', maintenanceType: '常规维护', maintenanceDate: addDays(T, -2), maintenancePerson: '张三', maintenanceContent: '阀杆润滑、执行机构行程检查', maintenanceResult: '完成', cost: 150, remark: '', createdAt: new Date().toISOString() }
]

const buildSeedPlans = (): MaintenancePlan[] => [
  { id: 1, equipmentId: 3, equipmentName: '阀门组C2', equipmentCode: 'VALVE-001', equipmentType: '阀门', maintenanceType: '常规维护', plannedDate: addDays(T, -12), assignee: '王五', cycleDays: 30, content: DEFAULT_PLAN_CONTENT['常规维护'], status: 'pending', remark: '已逾期，需优先安排', createdAt: new Date().toISOString() },
  { id: 2, equipmentId: 4, equipmentName: '压力传感器D5', equipmentCode: 'SENSOR-001', equipmentType: '传感器', maintenanceType: '故障维修', plannedDate: addDays(T, -3), assignee: '赵六', cycleDays: 0, content: DEFAULT_PLAN_CONTENT['故障维修'], status: 'pending', remark: '设备故障停机', createdAt: new Date().toISOString() },
  { id: 3, equipmentId: 6, equipmentName: '抽油机C1', equipmentCode: 'PUMP-003', equipmentType: '抽油机', maintenanceType: '定期保养', plannedDate: addDays(T, -25), assignee: '李四', cycleDays: 90, content: DEFAULT_PLAN_CONTENT['定期保养'], status: 'pending', remark: '严重逾期', createdAt: new Date().toISOString() },
  { id: 4, equipmentId: 2, equipmentName: '抽油机B3', equipmentCode: 'PUMP-002', equipmentType: '抽油机', maintenanceType: '常规维护', plannedDate: addDays(T, 5), assignee: '张三', cycleDays: 30, content: DEFAULT_PLAN_CONTENT['常规维护'], status: 'pending', createdAt: new Date().toISOString() },
  { id: 5, equipmentId: 1, equipmentName: '抽油机A1', equipmentCode: 'PUMP-001', equipmentType: '抽油机', maintenanceType: '常规维护', plannedDate: addDays(T, 10), assignee: '张三', cycleDays: 30, content: DEFAULT_PLAN_CONTENT['常规维护'], status: 'pending', createdAt: new Date().toISOString() },
  { id: 6, equipmentId: 7, equipmentName: '阀门组A3', equipmentCode: 'VALVE-002', equipmentType: '阀门', maintenanceType: '定期保养', plannedDate: addDays(T, 20), assignee: '王五', cycleDays: 90, content: DEFAULT_PLAN_CONTENT['定期保养'], status: 'pending', createdAt: new Date().toISOString() },
  { id: 7, equipmentId: 5, equipmentName: '电机E1', equipmentCode: 'MOTOR-001', equipmentType: '电机', maintenanceType: '定期保养', plannedDate: addDays(T, -60), assignee: '李四', cycleDays: 90, content: DEFAULT_PLAN_CONTENT['定期保养'], status: 'completed', remark: '', createdAt: new Date().toISOString(), completedAt: addDays(T, -60) }
]

interface MaintenanceState {
  equipmentList: ReturnType<typeof buildSeedEquipment>
  maintenanceRecords: MaintenanceRecord[]
  plans: MaintenancePlan[]
}

const loadState = (): MaintenanceState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MaintenanceState
      if (parsed.equipmentList?.length && Array.isArray(parsed.plans) && Array.isArray(parsed.maintenanceRecords)) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('加载本地维护数据失败，使用初始数据', e)
  }
  return {
    equipmentList: buildSeedEquipment(),
    maintenanceRecords: buildSeedRecords(),
    plans: buildSeedPlans()
  }
}

export const useMaintenanceStore = defineStore('maintenance', {
  state: (): MaintenanceState => loadState(),

  getters: {
    // ---------------- 设备统计 ----------------
    equipmentStats(state) {
      const list = state.equipmentList
      return {
        total: list.length,
        running: list.filter(e => e.status === '运行中').length,
        maintenance: list.filter(e => e.status === '待维护').length,
        fault: list.filter(e => e.status === '故障').length
      }
    },

    equipmentTypeDistribution(state): { name: string; value: number }[] {
      const map = new Map<string, number>()
      state.equipmentList.forEach(e => map.set(e.equipmentType, (map.get(e.equipmentType) || 0) + 1))
      return Array.from(map, ([name, value]) => ({ name, value }))
    },

    // ---------------- 计划视图 ----------------
    pendingPlans(state): MaintenancePlan[] {
      return state.plans
        .filter(p => p.status === 'pending')
        .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
    },

    planStats(state) {
      const pending = state.plans.filter(p => p.status === 'pending')
      return {
        total: state.plans.length,
        pending: pending.length,
        overdue: pending.filter(p => getRiskLevel(p.plannedDate) === 'overdue').length,
        completedThisMonth: state.plans.filter(
          p => p.status === 'completed' && (p.completedAt || '') >= monthStart()
        ).length
      }
    },

    /** 待维护提醒：待执行计划按日期升序，附带风险等级（供设备页时间线与概览看板共用） */
    reminders(state) {
      return state.plans
        .filter(p => p.status === 'pending')
        .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
        .map(p => ({
          ...p,
          risk: getRiskLevel(p.plannedDate),
          daysGap: diffDays(p.plannedDate, todayStr())
        }))
    },

    /** 按风险等级聚合待执行计划 */
    riskDistribution(): { key: RiskLevel; count: number }[] {
      const order: RiskLevel[] = ['overdue', 'soon', 'upcoming', 'normal']
      return order.map(key => ({
        key,
        count: this.pendingPlans.filter((p: MaintenancePlan) => getRiskLevel(p.plannedDate) === key).length
      }))
    },

    /** 按维护类型聚合待执行计划 */
    planTypeDistribution(): { name: string; value: number }[] {
      const map = new Map<string, number>()
      this.pendingPlans.forEach((p: MaintenancePlan) => map.set(p.maintenanceType, (map.get(p.maintenanceType) || 0) + 1))
      return MAINTENANCE_TYPES.filter(t => map.has(t)).map(name => ({ name, value: map.get(name) || 0 }))
    },

    /** 未来 30 天保养排期（逾期计划并入第 0 天） */
    upcomingSchedule(): { date: string; count: number }[] {
      const buckets = new Map<string, number>()
      this.pendingPlans.forEach((p: MaintenancePlan) => {
        const risk = getRiskLevel(p.plannedDate)
        if (risk === 'overdue') {
          buckets.set('已逾期', (buckets.get('已逾期') || 0) + 1)
        } else {
          const gap = diffDays(p.plannedDate, todayStr())
          if (gap <= 30) buckets.set(p.plannedDate, (buckets.get(p.plannedDate) || 0) + 1)
        }
      })
      return Array.from(buckets, ([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
    }
  },

  actions: {
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          equipmentList: this.equipmentList,
          maintenanceRecords: this.maintenanceRecords,
          plans: this.plans
        }))
      } catch (e) {
        console.error('维护计划保存失败：本地存储空间不足或被禁用', e)
        throw new Error('保存失败：本地存储空间不足或被浏览器禁用，请清理存储空间后重试')
      }
    },

    nextId(): number {
      const all = [...this.equipmentList, ...this.maintenanceRecords, ...this.plans]
      return all.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1
    },

    getEquipment(id: number) {
      return this.equipmentList.find(e => e.id === id)
    },

    getRecords(equipmentId?: number): MaintenanceRecord[] {
      const list = equipmentId
        ? this.maintenanceRecords.filter(r => r.equipmentId === equipmentId)
        : [...this.maintenanceRecords]
      return list.sort((a, b) => b.maintenanceDate.localeCompare(a.maintenanceDate))
    },

    /** 时间冲突：同一设备同一天已有其他待执行计划 */
    findConflict(equipmentId: number, plannedDate: string, excludePlanId?: number): MaintenancePlan | undefined {
      return this.plans.find(
        p =>
          p.status === 'pending' &&
          p.equipmentId === equipmentId &&
          p.plannedDate === plannedDate &&
          p.id !== excludePlanId
      )
    },

    // ---------------- 批量生成计划（事务性：冲突则整批不保存） ----------------
    generatePlans(params: GeneratePlansParams): PlanSaveResult[] {
      if (!params.equipmentIds.length) {
        throw new Error('未选择任何设备，请至少选择一台设备后再生成计划')
      }
      if (!params.assignee?.trim()) {
        throw new Error('请指定负责人后再生成计划')
      }

      // 1) 解析每台设备的计划日期
      const itemDateMap = new Map((params.items || []).map(i => [i.equipmentId, i.plannedDate]))
      const entries = params.equipmentIds.map(id => ({
        equipmentId: id,
        date: itemDateMap.get(id) ?? params.plannedDate
      }))
      if (entries.some(e => !e.date)) {
        throw new Error('部分设备缺少计划日期，请选择日期后重试')
      }

      // 2) 先计算全部结果，校验“与已有计划冲突”及“批次内设备互相冲突”；期间不写状态
      const results: PlanSaveResult[] = []
      const toCreate: Array<{ equipmentId: number; date: string }> = []
      // 本批次已占用的 设备+日期（含重复跳过项以外的新建项）
      const batchOccupied = new Set<string>()

      for (const { equipmentId, date } of entries) {
        const equipment = this.getEquipment(equipmentId)
        if (!equipment) {
          results.push({ success: false, equipmentName: `#${equipmentId}`, plannedDate: date, reason: '设备不存在' })
          continue
        }
        // 同设备同类型在目标日期已有待执行计划 → 跳过并说明原因
        const duplicate = this.plans.find(
          p =>
            p.status === 'pending' &&
            p.equipmentId === equipmentId &&
            p.maintenanceType === params.maintenanceType &&
            p.plannedDate === date
        )
        if (duplicate) {
          results.push({ success: false, equipmentName: equipment.equipmentName, plannedDate: date, reason: `已存在相同类型的待执行计划（#${duplicate.id}）` })
          continue
        }
        // 与已有计划时间冲突 → 整批回滚
        const conflict = this.findConflict(equipmentId, date)
        if (conflict) {
          throw new Error(
            `时间冲突：设备「${equipment.equipmentName}」在 ${date} 已有待执行的「${conflict.maintenanceType}」计划（#${conflict.id}）。本批计划未保存任何内容，请调整日期后重试。`
          )
        }
        // 批次内同设备同日期冲突（例如“按各设备下次保养日期”时两台日期撞在一起不会发生，
        // 但同一设备被重复选择、或混合模式下可能发生）
        const occKey = `${equipmentId}@${date}`
        if (batchOccupied.has(occKey)) {
          throw new Error(
            `时间冲突：设备「${equipment.equipmentName}」在本批次中 ${date} 被安排了多次。本批计划未保存任何内容，请去重或调整日期。`
          )
        }
        batchOccupied.add(occKey)
        toCreate.push({ equipmentId, date })
        results.push({ success: true, equipmentName: equipment.equipmentName, plannedDate: date })
      }

      // 3) 全部通过后再统一落库
      for (const { equipmentId, date } of toCreate) {
        const equipment = this.getEquipment(equipmentId)!
        this.plans.push({
          id: this.nextId(),
          equipmentId,
          equipmentName: equipment.equipmentName,
          equipmentCode: equipment.equipmentCode,
          equipmentType: equipment.equipmentType,
          maintenanceType: params.maintenanceType,
          plannedDate: date,
          assignee: params.assignee.trim(),
          cycleDays: params.cycleDays,
          content: params.content || DEFAULT_PLAN_CONTENT[params.maintenanceType] || '',
          status: 'pending',
          remark: params.remark,
          createdAt: new Date().toISOString()
        })
      }

      this.persist()
      return results
    },

    // ---------------- 单个保存 / 编辑 ----------------
    savePlan(payload: {
      id?: number
      equipmentId: number
      maintenanceType: string
      plannedDate: string
      assignee: string
      cycleDays: number
      content: string
      remark?: string
    }): { success: boolean; message: string } {
      const equipment = this.getEquipment(payload.equipmentId)
      if (!equipment) return { success: false, message: '保存失败：所选设备不存在，请刷新后重试' }
      if (!payload.plannedDate) return { success: false, message: '保存失败：请选择计划保养日期' }
      if (!payload.assignee?.trim()) return { success: false, message: '保存失败：请指定负责人' }

      const conflict = this.findConflict(payload.equipmentId, payload.plannedDate, payload.id)
      if (conflict) {
        return {
          success: false,
          message: `保存失败：该设备在 ${payload.plannedDate} 已有待执行的「${conflict.maintenanceType}」计划（#${conflict.id}），存在时间冲突`
        }
      }

      if (payload.id) {
        const plan = this.plans.find(p => p.id === payload.id)
        if (!plan) return { success: false, message: '保存失败：计划不存在或已被删除' }
        plan.equipmentId = equipment.id
        plan.equipmentName = equipment.equipmentName
        plan.equipmentCode = equipment.equipmentCode
        plan.equipmentType = equipment.equipmentType
        plan.maintenanceType = payload.maintenanceType
        plan.plannedDate = payload.plannedDate
        plan.assignee = payload.assignee.trim()
        plan.cycleDays = payload.cycleDays
        plan.content = payload.content
        plan.remark = payload.remark
      } else {
        this.plans.push({
          id: this.nextId(),
          equipmentId: equipment.id,
          equipmentName: equipment.equipmentName,
          equipmentCode: equipment.equipmentCode,
          equipmentType: equipment.equipmentType,
          maintenanceType: payload.maintenanceType,
          plannedDate: payload.plannedDate,
          assignee: payload.assignee.trim(),
          cycleDays: payload.cycleDays,
          content: payload.content,
          status: 'pending',
          remark: payload.remark,
          createdAt: new Date().toISOString()
        })
      }

      this.persist()
      return { success: true, message: '计划已保存' }
    },

    // ---------------- 批量调整负责人 / 周期 ----------------
    batchAdjust(params: BatchAdjustParams): { updated: number; skipped: { name: string; reason: string }[] } {
      const targets = this.plans.filter(p => params.planIds.includes(p.id) && p.status === 'pending')
      if (!targets.length) throw new Error('没有可调整的待执行计划（已完成或已取消的计划不可调整）')
      if (params.assignee !== undefined && !params.assignee.trim()) {
        throw new Error('批量调整失败：负责人不能为空')
      }

      // 预演：调整周期会重算计划日期，需要先检查全部时间冲突；任一冲突则整批不保存
      const newDates = new Map<number, string>()
      // 批次内每个设备重排后占用的日期（防止同设备的两条计划被排到同一天）
      const batchOccupied = new Map<number, string>()
      if (params.cycleDays !== undefined) {
        if (params.cycleDays < 0) throw new Error('批量调整失败：保养周期不能为负数')
        for (const plan of targets) {
          if (params.cycleDays === 0) continue // 一次性保养不重排日期
          const equipment = this.getEquipment(plan.equipmentId)
          const base = equipment?.lastMaintenanceDate || todayStr()
          let next = addDays(base, params.cycleDays)
          if (next < todayStr()) next = todayStr() // 重算后已过期则排到今天
          newDates.set(plan.id, next)

          // 与批次外的已有计划冲突
          const conflict = this.findConflict(plan.equipmentId, next, plan.id)
          if (conflict) {
            throw new Error(
              `批量调整失败：设备「${plan.equipmentName}」按新周期重排到 ${next}，与已有「${conflict.maintenanceType}」计划（#${conflict.id}）时间冲突。本批调整未保存。`
            )
          }
          // 与批次内其他计划的新日期冲突
          const occupied = batchOccupied.get(plan.equipmentId)
          if (occupied && occupied === next) {
            throw new Error(
              `批量调整失败：设备「${plan.equipmentName}」的多条计划按新周期都重排到 ${next}，批次内时间冲突。本批调整未保存，请拆分后分别调整。`
            )
          }
          batchOccupied.set(plan.equipmentId, next)
        }
      }

      const skipped: { name: string; reason: string }[] = []
      let updated = 0
      for (const plan of targets) {
        // 只改负责人、或日期不变时不做额外校验
        if (params.assignee !== undefined) plan.assignee = params.assignee.trim()
        if (params.cycleDays !== undefined) {
          plan.cycleDays = params.cycleDays
          const next = newDates.get(plan.id)
          if (next) {
            plan.plannedDate = next
          } else if (params.cycleDays === 0) {
            skipped.push({ name: plan.equipmentName, reason: '一次性保养（故障/紧急维修）不按周期重排，仅更新负责人' })
          }
        }
        updated++
      }

      this.persist()
      return { updated, skipped }
    },

    cancelPlan(id: number) {
      const plan = this.plans.find(p => p.id === id)
      if (!plan) throw new Error('计划不存在或已被删除')
      if (plan.status !== 'pending') throw new Error('仅待执行的计划可以取消')
      plan.status = 'cancelled'
      this.persist()
    },

    deletePlan(id: number) {
      const idx = this.plans.findIndex(p => p.id === id)
      if (idx === -1) throw new Error('计划不存在或已被删除')
      this.plans.splice(idx, 1)
      this.persist()
    },

    // ---------------- 完成维护（登记） ----------------
    /**
     * 登记维护结果。
     * - 新增一条维护记录（历史记录持续可查）
     * - 回写设备上次/下次保养日期与状态
     * - 若带 planId 或同设备同日期存在待执行计划，则把计划置为已完成
     * 记录、计划、设备统计在一次调用中同步更新。
     */
    completeMaintenance(payload: CompleteMaintenanceParams): MaintenanceRecord {
      const equipment = this.getEquipment(payload.equipmentId)
      if (!equipment) throw new Error('保存失败：设备不存在，请刷新后重试')
      if (!payload.maintenanceDate) throw new Error('保存失败：请选择维护日期')
      if (!payload.maintenancePerson?.trim()) throw new Error('保存失败：请填写维护人员')

      const record: MaintenanceRecord = {
        id: this.nextId(),
        equipmentId: payload.equipmentId,
        equipmentName: equipment.equipmentName,
        equipmentCode: equipment.equipmentCode,
        maintenanceType: payload.maintenanceType,
        maintenanceDate: payload.maintenanceDate,
        maintenancePerson: payload.maintenancePerson.trim(),
        maintenanceContent: payload.maintenanceContent,
        maintenanceResult: payload.maintenanceResult,
        cost: payload.cost,
        remark: payload.remark,
        createdAt: new Date().toISOString()
      }
      this.maintenanceRecords.unshift(record)

      // 回写设备保养信息
      equipment.lastMaintenanceDate = payload.maintenanceDate
      if (payload.nextMaintenanceDate) {
        equipment.nextMaintenanceDate = payload.nextMaintenanceDate
      } else {
        const cycle = DEFAULT_CYCLE[payload.maintenanceType] ?? 30
        equipment.nextMaintenanceDate = addDays(payload.maintenanceDate, cycle || 30)
      }
      if (payload.maintenanceResult === '完成') {
        equipment.status = '运行中'
      } else if (payload.maintenanceResult === '进行中') {
        equipment.status = '待维护'
      }

      // 关闭对应待执行计划：
      // 1) 从计划进入（planId）→ 精确关闭该计划
      // 2) 从设备列表直接登记 → 自动匹配同设备、同维护类型、且已到期（计划日期 <= 维护日期）
      //    的最近一条待执行计划；不同类型的计划不受影响，避免误关
      let plan: MaintenancePlan | undefined
      if (payload.planId) {
        plan = this.plans.find(p => p.id === payload.planId)
      } else {
        const candidates = this.plans
          .filter(
            p =>
              p.status === 'pending' &&
              p.equipmentId === payload.equipmentId &&
              p.maintenanceType === payload.maintenanceType &&
              p.plannedDate <= payload.maintenanceDate
          )
          .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate))
        plan = candidates[0]
      }
      if (plan && payload.maintenanceResult === '完成') {
        plan.status = 'completed'
        plan.completedAt = payload.maintenanceDate
      }

      this.persist()
      return record
    }
  }
})
