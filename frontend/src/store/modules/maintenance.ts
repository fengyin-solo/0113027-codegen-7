import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  Equipment,
  MaintenancePlan,
  MaintenanceRecord,
  PlanBatchUpdate,
  PlanConflict,
  PlanGenerateParams,
  PlanGenerateResult,
  RiskLevel
} from '@/api/equipment'

const STORAGE_KEY = 'maintenance-store-v1'
const VIEW_KEY = 'maintenance-view-v1'

export const MAINTENANCE_TYPES = ['常规维护', '故障维修', '定期保养', '紧急维修']
export const OWNER_OPTIONS = ['张三', '李四', '王五', '赵六', '孙七']
/** 同一负责人同一天最多安排的计划数量 */
export const DAILY_OWNER_CAPACITY = 3
const SOON_DAYS = 7

/** 生成相对日期的种子数据，保证演示时逾期/临期/正常三种状态都存在 */
const shiftDate = (base: Date, offsetDays: number) => {
  const d = new Date(base)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

interface PersistShape {
  equipmentList: Equipment[]
  maintenanceRecords: MaintenanceRecord[]
  planList: MaintenancePlan[]
  planSeq: number
}

interface PersistView {
  boardFilterStatus?: string
  workbench?: {
    keyword?: string
    status?: string
    riskLevel?: string
    maintenanceType?: string
    owner?: string
    dateRange?: string[]
  }
}

const seedEquipment = (): Equipment[] => {
  const today = new Date()
  return [
    { id: 1, equipmentCode: 'PUMP-001', equipmentName: '抽油机A1', equipmentType: '抽油机', model: 'CYJ12-4.8-73HB', installLocation: 'A井场1号', wellName: 'A-01井', runningHours: 8520, status: '运行中', lastMaintenanceDate: shiftDate(today, -20), nextMaintenanceDate: shiftDate(today, 10) },
    { id: 2, equipmentCode: 'PUMP-002', equipmentName: '抽油机B3', equipmentType: '抽油机', model: 'CYJ10-3-53HB', installLocation: 'B井场3号', wellName: 'B-03井', runningHours: 6350, status: '运行中', lastMaintenanceDate: shiftDate(today, -25), nextMaintenanceDate: shiftDate(today, 5) },
    { id: 3, equipmentCode: 'VALVE-001', equipmentName: '阀门组C2', equipmentType: '阀门', model: 'Z41H-16C DN100', installLocation: 'C井场2号', wellName: 'C-02井', runningHours: 12500, status: '待维护', lastMaintenanceDate: shiftDate(today, -45), nextMaintenanceDate: shiftDate(today, -15) },
    { id: 4, equipmentCode: 'SENSOR-001', equipmentName: '压力传感器D5', equipmentType: '传感器', model: 'PT-300', installLocation: 'D井场5号', wellName: 'D-05井', runningHours: 3200, status: '故障', lastMaintenanceDate: shiftDate(today, -50), nextMaintenanceDate: shiftDate(today, -20) },
    { id: 5, equipmentCode: 'MOTOR-001', equipmentName: '电机E1', equipmentType: '电机', model: 'Y2-315M-4', installLocation: 'E井场1号', wellName: 'E-01井', runningHours: 9800, status: '运行中', lastMaintenanceDate: shiftDate(today, -22), nextMaintenanceDate: shiftDate(today, 3) },
    { id: 6, equipmentCode: 'PUMP-003', equipmentName: '抽油机C1', equipmentType: '抽油机', model: 'CYJ12-4.8-73HB', installLocation: 'C井场1号', wellName: 'C-01井', runningHours: 7200, status: '待维护', lastMaintenanceDate: shiftDate(today, -40), nextMaintenanceDate: shiftDate(today, -10) },
    { id: 7, equipmentCode: 'VALVE-002', equipmentName: '阀门组A3', equipmentType: '阀门', model: 'Z41H-16C DN80', installLocation: 'A井场3号', wellName: 'A-03井', runningHours: 9500, status: '运行中', lastMaintenanceDate: shiftDate(today, -10), nextMaintenanceDate: shiftDate(today, 20) }
  ]
}

const seedRecords = (): MaintenanceRecord[] => [
  { id: 1, equipmentId: 1, equipmentName: '抽油机A1', equipmentCode: 'PUMP-001', maintenanceType: '常规维护', maintenanceDate: '2024-01-10', maintenancePerson: '张三', maintenanceContent: '检查润滑油、紧固螺丝、清洁设备表面', maintenanceResult: '完成', cost: 500, remark: '运行正常' },
  { id: 2, equipmentId: 1, equipmentName: '抽油机A1', equipmentCode: 'PUMP-001', maintenanceType: '定期保养', maintenanceDate: '2023-10-15', maintenancePerson: '李四', maintenanceContent: '更换油封、检查皮带张力', maintenanceResult: '完成', cost: 1200, remark: '皮带磨损正常' },
  { id: 3, equipmentId: 3, equipmentName: '阀门组C2', equipmentCode: 'VALVE-001', maintenanceType: '常规维护', maintenanceDate: '2023-12-20', maintenancePerson: '王五', maintenanceContent: '阀门开关测试、密封检查', maintenanceResult: '完成', cost: 200, remark: '一切正常' }
]

export const getRiskLevel = (nextDate: string): RiskLevel => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(nextDate)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return '逾期'
  if (diffDays <= SOON_DAYS) return '临期'
  return '正常'
}

export const useMaintenanceStore = defineStore('maintenance', () => {
  const equipmentList = ref<Equipment[]>([])
  const maintenanceRecords = ref<MaintenanceRecord[]>([])
  const planList = ref<MaintenancePlan[]>([])
  const planSeq = ref(1)
  const recordSeq = ref(100)
  const loaded = ref(false)

  const persist = () => {
    const data: PersistShape = {
      equipmentList: equipmentList.value,
      maintenanceRecords: maintenanceRecords.value,
      planList: planList.value,
      planSeq: planSeq.value
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      throw new Error('计划保存失败：浏览器本地存储空间不足，请清理后重试')
    }
  }

  const load = () => {
    if (loaded.value) return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const data = JSON.parse(raw) as PersistShape
        equipmentList.value = data.equipmentList || []
        maintenanceRecords.value = data.maintenanceRecords || []
        planList.value = (data.planList || []).map((p) => ({ ...p, conflicts: p.conflicts || [] }))
        planSeq.value = data.planSeq || 1
      } catch {
        equipmentList.value = seedEquipment()
        maintenanceRecords.value = seedRecords()
      }
    } else {
      equipmentList.value = seedEquipment()
      maintenanceRecords.value = seedRecords()
    }
    recordSeq.value = maintenanceRecords.value.reduce((m, r) => Math.max(m, r.id || 0), 100) + 1
    loaded.value = true
  }

  const resetAll = () => {
    equipmentList.value = seedEquipment()
    maintenanceRecords.value = seedRecords()
    planList.value = []
    planSeq.value = 1
    persist()
  }

  // ---------- getters ----------
  const equipmentStats = computed(() => ({
    total: equipmentList.value.length,
    running: equipmentList.value.filter((e) => e.status === '运行中').length,
    maintenance: equipmentList.value.filter((e) => e.status === '待维护').length,
    fault: equipmentList.value.filter((e) => e.status === '故障').length
  }))

  const equipmentWithRisk = computed(() =>
    equipmentList.value.map((e) => ({ ...e, riskLevel: getRiskLevel(e.nextMaintenanceDate) }))
  )

  const overdueEquipments = computed(() =>
    equipmentWithRisk.value.filter((e) => e.riskLevel === '逾期')
  )

  const dueSoonEquipments = computed(() =>
    equipmentWithRisk.value.filter((e) => e.riskLevel === '临期')
  )

  /** 待维护设备提醒时间线：先逾期、后临期，按下次保养日期升序 */
  const reminderList = computed(() => {
    const typeMap: Record<RiskLevel, 'danger' | 'warning' | 'primary'> = {
      逾期: 'danger',
      临期: 'warning',
      正常: 'primary'
    }
    return equipmentWithRisk.value
      .filter((e) => e.riskLevel !== '正常')
      .sort((a, b) => a.nextMaintenanceDate.localeCompare(b.nextMaintenanceDate))
      .map((e) => ({
        id: e.id,
        date: e.nextMaintenanceDate,
        equipmentName: e.equipmentName,
        equipmentCode: e.equipmentCode,
        riskLevel: e.riskLevel,
        type: typeMap[e.riskLevel],
        content:
          e.riskLevel === '逾期'
            ? `已逾期，请尽快安排${e.status === '故障' ? '维修' : '保养'}`
            : '保养即将到期'
      }))
  })

  /** 计划当前风险：以设备最新的下次保养日期为准，完成维护后自动解除逾期 */
  const planRisk = (plan: MaintenancePlan): RiskLevel => {
    const equipment = findEquipment(plan.equipmentId)
    return equipment ? getRiskLevel(equipment.nextMaintenanceDate) : plan.riskLevel
  }

  const activePlans = computed(() =>
    planList.value.filter((p) => p.status !== '已完成' && p.status !== '已取消')
  )

  const planStats = computed(() => {
    const active = activePlans.value
    return {
      total: planList.value.length,
      pending: planList.value.filter((p) => p.status === '待安排').length,
      scheduled: planList.value.filter((p) => p.status === '已安排').length,
      inProgress: planList.value.filter((p) => p.status === '进行中').length,
      completed: planList.value.filter((p) => p.status === '已完成').length,
      overdue: active.filter((p) => planRisk(p) === '逾期').length,
      conflict: active.filter((p) => p.conflicts.length > 0).length
    }
  })

  const typeDistribution = computed(() => {
    const map = new Map<string, number>()
    equipmentList.value.forEach((e) => map.set(e.equipmentType, (map.get(e.equipmentType) || 0) + 1))
    return Array.from(map, ([name, value]) => ({ name, value }))
  })

  /** 看板：按日期聚合未来 14 天的有效计划数量 */
  const scheduleByDate = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days: { date: string; label: string; count: number }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().split('T')[0]
      days.push({ date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, count: 0 })
    }
    const index = new Map(days.map((d, i) => [d.date, i]))
    activePlans.value.forEach((p) => {
      const i = index.get(p.planDate)
      if (i !== undefined) days[i].count++
    })
    return days
  })

  const ownerDistribution = computed(() => {
    const map = new Map<string, number>()
    activePlans.value.forEach((p) => {
      const key = p.owner || '未分配'
      map.set(key, (map.get(key) || 0) + 1)
    })
    return Array.from(map, ([name, value]) => ({ name, value }))
  })

  // ---------- actions ----------
  const findEquipment = (id: number) => equipmentList.value.find((e) => e.id === id)

  const recordsOf = (equipmentId: number) =>
    maintenanceRecords.value
      .filter((r) => r.equipmentId === equipmentId)
      .sort((a, b) => b.maintenanceDate.localeCompare(a.maintenanceDate))

  /**
   * 按设备、维护类型、逾期风险和下次保养日期生成计划
   */
  const generatePlans = (params: PlanGenerateParams): PlanGenerateResult => {
    const messages: string[] = []
    const conflicts: PlanConflict[] = []
    let created = 0
    let skipped = 0

    if (!params.dateFrom || !params.dateTo) {
      throw new Error('请选择计划安排的起止日期')
    }
    if (params.dateFrom > params.dateTo) {
      throw new Error('开始日期不能晚于结束日期')
    }
    if (params.defaultCycleDays <= 0) {
      throw new Error('默认保养周期必须大于 0 天')
    }

    let candidates = equipmentWithRisk.value
    if (params.scope === 'overdue') candidates = candidates.filter((e) => e.riskLevel === '逾期')
    if (params.scope === 'due') {
      candidates = candidates.filter((e) => e.riskLevel === '逾期' || e.riskLevel === '临期')
    }
    if (params.equipmentIds.length > 0) {
      candidates = candidates.filter((e) => params.equipmentIds.includes(e.id!))
    }
    if (params.riskLevels.length > 0) {
      candidates = candidates.filter((e) => params.riskLevels.includes(e.riskLevel))
    }

    if (candidates.length === 0) {
      throw new Error('当前筛选条件下没有可生成计划的设备，请调整设备范围或风险条件')
    }

    // 范围内已存在有效计划的设备去重
    const existingEquipIds = new Set(activePlans.value.map((p) => p.equipmentId))

    const defaultType = (equipment: Equipment & { riskLevel: RiskLevel }) => {
      if (params.maintenanceTypes.length > 0) return params.maintenanceTypes[0]
      if (equipment.status === '故障') return '故障维修'
      if (equipment.riskLevel === '逾期') return '紧急维修'
      return '定期保养'
    }

    /** 在区间内为每台设备挑选日期：优先贴近下次保养日期，受当日负责人容量约束 */
    // 本批次新分配计数：key = 负责人|日期，连同已有计划一起参与容量计算
    const newAssignments = new Map<string, number>()
    const countOn = (owner: string, key: string) => {
      const existed = activePlans.value.filter((p) => p.owner === owner && p.planDate === key).length
      return existed + (newAssignments.get(`${owner}|${key}`) || 0)
    }
    const pickDate = (preferred: Date, owner: string): string | null => {
      const start = new Date(params.dateFrom)
      const end = new Date(params.dateTo)
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      preferred.setHours(0, 0, 0, 0)
      const cursor = new Date(Math.max(preferred.getTime(), start.getTime()))
      for (let i = 0; ; i++) {
        const d = new Date(cursor)
        d.setDate(d.getDate() + i)
        if (d > end) return null
        const key = d.toISOString().split('T')[0]
        if (!owner) return key
        if (countOn(owner, key) < DAILY_OWNER_CAPACITY) return key
      }
    }

    candidates.forEach((equipment) => {
      if (existingEquipIds.has(equipment.id!)) {
        skipped++
        messages.push(`${equipment.equipmentName}：已有进行中的保养计划，已跳过`)
        return
      }

      const preferred = new Date(equipment.nextMaintenanceDate)
      const planDate = pickDate(preferred, params.defaultOwner)
      if (!planDate) {
        skipped++
        messages.push(`${equipment.equipmentName}：日期区间内无可用排班（负责人当日任务已满），已跳过`)
        return
      }

      const reasons: string[] = []
      const risk = getRiskLevel(equipment.nextMaintenanceDate)
      if (risk === '逾期') reasons.push(`下次保养日期 ${equipment.nextMaintenanceDate} 已逾期`)
      if (planDate > equipment.nextMaintenanceDate) {
        reasons.push(`计划日期晚于下次保养日期 ${equipment.nextMaintenanceDate}`)
      }
      if (params.defaultOwner) {
        const beforeCount = countOn(params.defaultOwner, planDate)
        if (beforeCount > 0) {
          reasons.push(
            `负责人 ${params.defaultOwner} 当日已有 ${beforeCount} 项任务（上限 ${DAILY_OWNER_CAPACITY} 项）`
          )
        }
        newAssignments.set(
          `${params.defaultOwner}|${planDate}`,
          (newAssignments.get(`${params.defaultOwner}|${planDate}`) || 0) + 1
        )
      } else {
        reasons.push('尚未指定负责人')
      }

      const plan: MaintenancePlan = {
        id: planSeq.value++,
        equipmentId: equipment.id!,
        equipmentName: equipment.equipmentName,
        equipmentCode: equipment.equipmentCode,
        equipmentType: equipment.equipmentType,
        maintenanceType: defaultType(equipment),
        planDate,
        cycleDays: params.defaultCycleDays,
        owner: params.defaultOwner,
        riskLevel: risk,
        status: params.defaultOwner ? '已安排' : '待安排',
        conflicts: reasons,
        createdAt: new Date().toISOString()
      }
      planList.value.push(plan)
      created++
      if (reasons.length > 0) {
        conflicts.push({ planId: plan.id, equipmentName: equipment.equipmentName, planDate, reasons })
      }
    })

    if (created === 0) {
      // 全部跳过时不抛异常，返回明细由界面逐条说明原因
      try {
        persist()
      } catch {
        /* 无新增计划，持久化失败可忽略 */
      }
      return { created, skipped, conflicts, messages }
    }

    try {
      persist()
    } catch (e) {
      throw e instanceof Error ? e : new Error('计划保存失败，请重试')
    }

    return { created, skipped, conflicts, messages }
  }

  /** 批量调整负责人 / 周期 / 日期偏移，返回冲突信息 */
  const batchUpdatePlans = (ids: number[], update: PlanBatchUpdate): PlanConflict[] => {
    if (ids.length === 0) throw new Error('请先勾选需要调整的计划')
    if (update.cycleDays !== undefined && update.cycleDays <= 0) {
      throw new Error('保养周期必须大于 0 天')
    }

    const targets = planList.value.filter(
      (p) => ids.includes(p.id) && p.status !== '已完成' && p.status !== '已取消'
    )
    if (targets.length === 0) {
      throw new Error('所选计划均已完成或已取消，无法调整')
    }

    const conflicts: PlanConflict[] = []

    targets.forEach((plan) => {
      const reasons: string[] = []
      if (update.owner !== undefined) {
        plan.owner = update.owner
        if (!update.owner) {
          plan.status = '待安排'
          reasons.push('尚未指定负责人')
        } else if (plan.status === '待安排') {
          plan.status = '已安排'
        }
      }
      if (update.cycleDays !== undefined) {
        plan.cycleDays = update.cycleDays
      }
      if (update.dateOffsetDays !== undefined && update.dateOffsetDays !== 0) {
        const d = new Date(plan.planDate)
        d.setDate(d.getDate() + update.dateOffsetDays)
        plan.planDate = d.toISOString().split('T')[0]
      }

      const equipment = findEquipment(plan.equipmentId)
      if (equipment && plan.planDate > equipment.nextMaintenanceDate) {
        reasons.push(`计划日期晚于下次保养日期 ${equipment.nextMaintenanceDate}`)
      }
      if (plan.owner) {
        const sameDay = planList.value.filter(
          (p) =>
            p.id !== plan.id &&
            p.owner === plan.owner &&
            p.planDate === plan.planDate &&
            p.status !== '已完成' &&
            p.status !== '已取消'
        )
        if (sameDay.length + 1 > DAILY_OWNER_CAPACITY) {
          reasons.push(
            `负责人 ${plan.owner} 当日任务超过 ${DAILY_OWNER_CAPACITY} 项上限，请错峰安排`
          )
        }
      }
      plan.conflicts = reasons
      if (reasons.length > 0) {
        conflicts.push({ planId: plan.id, equipmentName: plan.equipmentName, planDate: plan.planDate, reasons })
      }
    })

    persist()
    return conflicts
  }

  /** 完成维护：同步设备、逾期提醒、统计卡片，并追加一条维护记录 */
  const completePlan = (
    plan: MaintenancePlan,
    payload: {
      maintenancePerson?: string
      maintenanceContent: string
      maintenanceResult: string
      cost?: number
      remark?: string
    }
  ) => {
    const target = planList.value.find((p) => p.id === plan.id)
    if (!target) throw new Error('计划不存在或已被删除')
    if (target.status === '已完成') throw new Error('该计划已完成，请勿重复提交')

    const today = new Date().toISOString().split('T')[0]
    const next = new Date(today)
    next.setDate(next.getDate() + target.cycleDays)
    const nextDate = next.toISOString().split('T')[0]

    const record: MaintenanceRecord = {
      id: recordSeq.value++,
      equipmentId: target.equipmentId,
      equipmentName: target.equipmentName,
      equipmentCode: target.equipmentCode,
      maintenanceType: target.maintenanceType,
      maintenanceDate: today,
      maintenancePerson: payload.maintenancePerson || target.owner,
      maintenanceContent: payload.maintenanceContent,
      maintenanceResult: payload.maintenanceResult,
      cost: payload.cost,
      remark: payload.remark,
      createdAt: new Date().toISOString()
    }
    maintenanceRecords.value.unshift(record)

    const equipment = findEquipment(target.equipmentId)
    if (equipment) {
      equipment.lastMaintenanceDate = today
      equipment.nextMaintenanceDate = nextDate
      if (payload.maintenanceResult === '完成') equipment.status = '运行中'
    }

    target.status = '已完成'
    target.completedAt = new Date().toISOString()
    target.conflicts = []

    persist()
  }

  /** 维护登记弹窗直接登记（不经过计划） */
  const addMaintenanceRecord = (record: Omit<MaintenanceRecord, 'id' | 'createdAt'>) => {
    const full: MaintenanceRecord = {
      ...record,
      id: recordSeq.value++,
      createdAt: new Date().toISOString()
    }
    maintenanceRecords.value.unshift(full)

    const equipment = findEquipment(record.equipmentId)
    if (equipment) {
      equipment.lastMaintenanceDate = record.maintenanceDate
      if (record.nextMaintenanceDate) {
        equipment.nextMaintenanceDate = record.nextMaintenanceDate
      }
      if (record.maintenanceResult === '完成') equipment.status = '运行中'
    }

    // 登记完成后，对应设备上未完成的计划自动标记完成，保持提醒一致
    planList.value
      .filter(
        (p) => p.equipmentId === record.equipmentId && p.status !== '已完成' && p.status !== '已取消'
      )
      .forEach((p) => {
        p.status = '已完成'
        p.completedAt = new Date().toISOString()
        p.conflicts = []
      })

    persist()
  }

  const cancelPlan = (id: number) => {
    const plan = planList.value.find((p) => p.id === id)
    if (!plan) throw new Error('计划不存在')
    if (plan.status === '已完成') throw new Error('已完成的计划不能取消')
    plan.status = '已取消'
    plan.conflicts = []
    persist()
  }

  // ---------- 视图状态持久化（重新进入后保留计划视图） ----------
  const loadView = (): PersistView => {
    try {
      return JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') as PersistView
    } catch {
      return {}
    }
  }

  const saveView = (view: PersistView) => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(view))
    } catch {
      /* 视图状态保存失败不阻塞操作 */
    }
  }

  return {
    equipmentList,
    maintenanceRecords,
    planList,
    load,
    resetAll,
    persist,
    equipmentStats,
    equipmentWithRisk,
    overdueEquipments,
    dueSoonEquipments,
    reminderList,
    activePlans,
    planStats,
    typeDistribution,
    scheduleByDate,
    ownerDistribution,
    findEquipment,
    recordsOf,
    generatePlans,
    batchUpdatePlans,
    completePlan,
    addMaintenanceRecord,
    cancelPlan,
    loadView,
    saveView
  }
})
