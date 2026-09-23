<template>
  <div class="workbench-container">
    <!-- 生成计划面板 -->
    <el-card class="mb-20">
      <template #header>
        <div class="card-header">
          <span>生成保养计划</span>
          <el-button link type="primary" @click="showGenerate = !showGenerate">
            {{ showGenerate ? '收起' : '展开' }}
          </el-button>
        </div>
      </template>

      <el-form v-show="showGenerate" :model="genForm" label-width="100px" class="gen-form">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="设备范围">
              <el-radio-group v-model="genForm.scope">
                <el-radio-button label="all">全部设备</el-radio-button>
                <el-radio-button label="due">逾期+临期</el-radio-button>
                <el-radio-button label="overdue">仅逾期</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="维护类型">
              <el-select
                v-model="genForm.maintenanceTypes"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="不选则按设备风险自动匹配"
                style="width: 100%"
              >
                <el-option v-for="t in MAINTENANCE_TYPES" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="风险等级">
              <el-checkbox-group v-model="genForm.riskLevels">
                <el-checkbox-button label="逾期" />
                <el-checkbox-button label="临期" />
                <el-checkbox-button label="正常" />
              </el-checkbox-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="指定设备">
              <el-select
                v-model="genForm.equipmentIds"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="不选则使用范围内全部设备"
                style="width: 100%"
              >
                <el-option
                  v-for="e in candidateEquipments"
                  :key="e.id"
                  :label="`${e.equipmentName}（${riskOf(e.nextMaintenanceDate)}）`"
                  :value="e.id!"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="安排日期区间">
              <el-date-picker
                v-model="genDateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="默认负责人">
              <el-select v-model="genForm.defaultOwner" clearable placeholder="可留空" style="width: 100%">
                <el-option v-for="o in OWNER_OPTIONS" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="保养周期">
              <el-input-number v-model="genForm.defaultCycleDays" :min="1" :max="365" />
              <span class="cycle-unit">天</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24" class="gen-tips">
            <el-text type="info" size="small">
              规则：计划日期优先取设备下次保养日期；同一负责人每日最多安排 {{ DAILY_OWNER_CAPACITY }} 项，超出将自动顺延，区间内排不下则跳过；已有进行中计划的设备自动去重。
            </el-text>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" :loading="generating" @click="handleGenerate">生成计划</el-button>
          <el-button @click="resetGenForm">重置条件</el-button>
          <el-button type="danger" plain @click="handleResetAll">清空全部数据（恢复演示）</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 计划列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>保养计划（{{ filteredPlans.length }}/{{ store.planList.length }}）</span>
          <div>
            <el-button type="primary" size="small" @click="goBoard">返回概览看板</el-button>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="filterForm" class="filter-form mb-20">
        <el-form-item label="设备">
          <el-input v-model="filterForm.keyword" placeholder="设备名称/编码" clearable />
        </el-form-item>
        <el-form-item label="维护类型">
          <el-select v-model="filterForm.maintenanceType" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="t in MAINTENANCE_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="风险">
          <el-select v-model="filterForm.riskLevel" placeholder="全部" clearable style="width: 110px">
            <el-option label="逾期" value="逾期" />
            <el-option label="临期" value="临期" />
            <el-option label="正常" value="正常" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 110px">
            <el-option label="待安排" value="待安排" />
            <el-option label="已安排" value="已安排" />
            <el-option label="进行中" value="进行中" />
            <el-option label="已完成" value="已完成" />
            <el-option label="已取消" value="已取消" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="filterForm.owner" placeholder="全部" clearable style="width: 110px">
            <el-option v-for="o in OWNER_OPTIONS" :key="o" :label="o" :value="o" />
            <el-option label="未分配" value="__none__" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>

      <div v-if="selectedPlans.length > 0" class="batch-bar mb-20">
        <span>已选 {{ selectedPlans.length }} 项</span>
        <el-divider direction="vertical" />
        <el-select v-model="batchOwner" placeholder="批量改负责人" clearable size="small" style="width: 140px">
          <el-option v-for="o in OWNER_OPTIONS" :key="o" :label="o" :value="o" />
        </el-select>
        <el-input-number v-model="batchCycle" :min="1" :max="365" placeholder="周期(天)" size="small" controls-position="right" style="width: 130px" />
        <el-select v-model="batchOffset" placeholder="顺延/提前" clearable size="small" style="width: 130px">
          <el-option label="提前 7 天" :value="-7" />
          <el-option label="提前 3 天" :value="-3" />
          <el-option label="提前 1 天" :value="-1" />
          <el-option label="延后 1 天" :value="1" />
          <el-option label="延后 3 天" :value="3" />
          <el-option label="延后 7 天" :value="7" />
        </el-select>
        <el-button type="primary" size="small" @click="applyBatch">应用批量调整</el-button>
      </div>

      <el-table
        :data="filteredPlans"
        border
        stripe
        style="width: 100%"
        @selection-change="onSelectionChange"
        :row-key="(row: MaintenancePlan) => row.id"
      >
        <el-table-column type="selection" width="45" :selectable="(row: MaintenancePlan) => row.status !== '已完成' && row.status !== '已取消'" />
        <el-table-column prop="planDate" label="计划日期" width="110" sortable />
        <el-table-column prop="equipmentCode" label="设备编码" width="110" />
        <el-table-column prop="equipmentName" label="设备名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="equipmentType" label="设备类型" width="90" />
        <el-table-column prop="maintenanceType" label="维护类型" width="100">
          <template #default="{ row }">
            <el-tag :type="maintenanceTypeColor(row.maintenanceType)" size="small">{{ row.maintenanceType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="风险" width="80">
          <template #default="{ row }">
            <el-tag :type="riskTagType(row.riskLevel)" size="small">{{ row.riskLevel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="110">
          <template #default="{ row }">
          <el-select
            v-model="row.owner"
            size="small"
            :disabled="row.status === '已完成' || row.status === '已取消'"
            placeholder="未分配"
            @change="(v: string) => onOwnerInline(row, v)"
          >
            <el-option v-for="o in OWNER_OPTIONS" :key="o" :label="o" :value="o" />
          </el-select>
          </template>
        </el-table-column>
        <el-table-column label="周期(天)" width="100">
          <template #default="{ row }">
            <el-input-number
              v-model="row.cycleDays"
              :min="1"
              :max="365"
              size="small"
              controls-position="right"
              :disabled="row.status === '已完成' || row.status === '已取消'"
              @change="(v: number) => onCycleInline(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="冲突" width="90">
          <template #default="{ row }">
            <el-tooltip v-if="row.conflicts.length > 0" placement="top" effect="light">
              <template #content>
                <div v-for="(r, i) in row.conflicts" :key="i" class="conflict-tip">{{ r }}</div>
              </template>
              <el-tag type="danger" size="small">冲突 {{ row.conflicts.length }}</el-tag>
            </el-tooltip>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="success" size="small" link :disabled="row.status === '已完成'" @click="openComplete(row)">完成维护</el-button>
            <el-button type="primary" size="small" link :disabled="row.status === '已完成' || row.status === '已取消'" @click="viewRecords(row)">维护记录</el-button>
            <el-button type="danger" size="small" link :disabled="row.status === '已完成' || row.status === '已取消'" @click="handleCancel(row)">取消</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无保养计划，请在上方按设备、维护类型、逾期风险和下次保养日期生成" />
        </template>
      </el-table>
    </el-card>

    <!-- 完成维护弹窗 -->
    <el-dialog v-model="completeVisible" title="完成维护登记" width="560px" :close-on-click-modal="false">
      <el-form v-if="completeTarget" :model="completeForm" :rules="completeRules" ref="completeFormRef" label-width="100px">
        <el-form-item label="设备名称">
          <el-input :model-value="completeTarget.equipmentName" disabled />
        </el-form-item>
        <el-form-item label="维护类型">
          <el-input :model-value="completeTarget.maintenanceType" disabled />
        </el-form-item>
        <el-form-item label="完成日期">
          <el-input :model-value="todayStr" disabled />
        </el-form-item>
        <el-form-item label="下次保养">
          <el-input :model-value="nextDatePreview" disabled />
          <span class="form-hint">按周期 {{ completeTarget.cycleDays }} 天自动推算，可在完成后调整周期</span>
        </el-form-item>
        <el-form-item label="维护人员" prop="maintenancePerson">
          <el-input v-model="completeForm.maintenancePerson" placeholder="请输入维护人员" />
        </el-form-item>
        <el-form-item label="维护内容" prop="maintenanceContent">
          <el-input v-model="completeForm.maintenanceContent" type="textarea" :rows="3" placeholder="请描述本次维护内容" />
        </el-form-item>
        <el-form-item label="维护结果" prop="maintenanceResult">
          <el-radio-group v-model="completeForm.maintenanceResult">
            <el-radio label="完成">完成</el-radio>
            <el-radio label="进行中">进行中</el-radio>
            <el-radio label="待跟进">待跟进</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="维护费用">
          <el-input-number v-model="completeForm.cost" :min="0" :precision="2" placeholder="元" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="completeForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitComplete">确认完成</el-button>
      </template>
    </el-dialog>

    <!-- 维护记录弹窗（已有记录继续可查） -->
    <el-dialog v-model="recordVisible" title="维护记录" width="760px">
      <div class="record-info" v-if="recordTarget">
        <span class="label">设备：</span>
        <span class="value">{{ recordTarget.equipmentName }}（{{ recordTarget.equipmentCode }}）</span>
      </div>
      <el-table :data="planRecords" border stripe size="small" style="width: 100%; margin-top: 12px">
        <el-table-column prop="maintenanceDate" label="维护日期" width="110" />
        <el-table-column prop="maintenanceType" label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="maintenanceTypeColor(row.maintenanceType)" size="small">{{ row.maintenanceType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="maintenancePerson" label="维护人员" width="90" />
        <el-table-column prop="maintenanceContent" label="维护内容" min-width="180" show-overflow-tooltip />
        <el-table-column prop="maintenanceResult" label="结果" width="80">
          <template #default="{ row }">
            <el-tag :type="resultColor(row.maintenanceResult)" size="small">{{ row.maintenanceResult }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="planRecords.length === 0" description="该设备暂无维护记录" :image-size="60" />
      <template #footer>
        <el-button @click="recordVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 生成/调整结果弹窗：说明冲突与跳过原因 -->
    <el-dialog v-model="resultVisible" title="计划生成结果" width="600px">
      <el-result :icon="resultIcon" :title="resultTitle" :sub-title="resultSubTitle" />
      <div v-if="lastResult" class="result-body">
        <el-tag type="success" class="mr-10">成功生成 {{ lastResult.created }} 项</el-tag>
        <el-tag v-if="lastResult.skipped > 0" type="info" class="mr-10">跳过 {{ lastResult.skipped }} 项</el-tag>
        <el-tag v-if="lastResult.conflicts.length > 0" type="danger">冲突 {{ lastResult.conflicts.length }} 项</el-tag>
        <el-timeline v-if="resultLines.length > 0" class="mt-15">
          <el-timeline-item
            v-for="(line, i) in resultLines"
            :key="i"
            :type="line.level"
            :timestamp="line.date"
          >
            <strong>{{ line.name }}</strong>：{{ line.text }}
          </el-timeline-item>
        </el-timeline>
      </div>
      <template #footer>
        <el-button type="primary" @click="resultVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  DAILY_OWNER_CAPACITY,
  MAINTENANCE_TYPES,
  OWNER_OPTIONS,
  getRiskLevel,
  useMaintenanceStore
} from '@/store/modules/maintenance'
import type {
  MaintenancePlan,
  MaintenanceRecord,
  PlanConflict,
  PlanGenerateParams,
  PlanGenerateResult,
  RiskLevel
} from '@/api/equipment'

const router = useRouter()
const route = useRoute()
const store = useMaintenanceStore()
store.load()

const todayStr = new Date().toISOString().split('T')[0]
const showGenerate = ref(true)
const generating = ref(false)

// ---------- 生成表单 ----------
const defaultDateRange = (): string[] => {
  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 30)
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
}

const genForm = reactive({
  scope: 'due' as PlanGenerateParams['scope'],
  equipmentIds: [] as number[],
  maintenanceTypes: [] as string[],
  riskLevels: [] as RiskLevel[],
  defaultOwner: '',
  defaultCycleDays: 30
})
const genDateRange = ref<string[]>(defaultDateRange())

const candidateEquipments = computed(() => {
  let list = store.equipmentWithRisk
  if (genForm.scope === 'overdue') list = list.filter((e) => e.riskLevel === '逾期')
  if (genForm.scope === 'due') list = list.filter((e) => e.riskLevel !== '正常')
  return list
})

const resetGenForm = () => {
  genForm.scope = 'due'
  genForm.equipmentIds = []
  genForm.maintenanceTypes = []
  genForm.riskLevels = []
  genForm.defaultOwner = ''
  genForm.defaultCycleDays = 30
  genDateRange.value = defaultDateRange()
}

const handleGenerate = () => {
  try {
    if (!genDateRange.value || genDateRange.value.length !== 2) {
      ElMessage.warning('请选择安排日期区间')
      return
    }
    generating.value = true
    // 模拟异步保存
    setTimeout(() => {
      try {
        const result = store.generatePlans({
          scope: genForm.scope,
          equipmentIds: genForm.equipmentIds,
          maintenanceTypes: genForm.maintenanceTypes,
          riskLevels: genForm.riskLevels,
          dateFrom: genDateRange.value[0],
          dateTo: genDateRange.value[1],
          defaultOwner: genForm.defaultOwner,
          defaultCycleDays: genForm.defaultCycleDays
        })
        if (result.created === 0) {
          showResult(result)
          ElMessage.warning('未生成任何计划，请查看跳过原因')
        } else {
          showResult(result)
        }
      } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : '计划生成失败')
      } finally {
        generating.value = false
      }
    }, 300)
  } catch (e) {
    generating.value = false
    ElMessage.error(e instanceof Error ? e.message : '计划生成失败')
  }
}

// ---------- 结果弹窗 ----------
const resultVisible = ref(false)
const lastResult = ref<PlanGenerateResult | null>(null)

const resultLines = computed(() => {
  if (!lastResult.value) return []
  const lines: { name: string; date?: string; text: string; level: 'danger' | 'warning' | 'success' | 'info' }[] = []
  lastResult.value.conflicts.forEach((c) => {
    lines.push({ name: c.equipmentName, date: c.planDate, text: c.reasons.join('；'), level: 'danger' })
  })
  lastResult.value.messages.forEach((m) => {
    const name = m.split('：')[0]
    const text = m.split('：')[1] || m
    lines.push({ name, text, level: 'info' })
  })
  return lines
})

const resultIcon = computed(() => {
  if (!lastResult.value) return 'info'
  if (lastResult.value.created === 0) return 'info'
  if (lastResult.value.conflicts.length > 0) return 'warning'
  return 'success'
})
const resultTitle = computed(() => {
  if (!lastResult.value) return ''
  return lastResult.value.created === 0
    ? '未生成新计划'
    : `已生成 ${lastResult.value.created} 项计划`
})
const resultSubTitle = computed(() => {
  if (!lastResult.value) return ''
  const parts: string[] = []
  if (lastResult.value.skipped > 0) parts.push(`${lastResult.value.skipped} 项跳过`)
  if (lastResult.value.conflicts.length > 0) parts.push(`${lastResult.value.conflicts.length} 项存在冲突，请关注`)
  return parts.length > 0 ? parts.join('，') : '全部计划安排正常'
})

const showResult = (result: PlanGenerateResult) => {
  lastResult.value = result
  resultVisible.value = true
  if (result.conflicts.length === 0 && result.skipped === 0) {
    ElMessage.success(`成功生成 ${result.created} 项保养计划`)
  } else {
    ElMessage.warning(`生成 ${result.created} 项，${result.skipped} 项跳过，${result.conflicts.length} 项冲突`)
  }
}

// ---------- 筛选（视图状态持久化） ----------
interface FilterState {
  keyword: string
  status: string
  riskLevel: string
  maintenanceType: string
  owner: string
  dateRange: string[]
}

const filterForm = reactive<FilterState>({
  keyword: '',
  status: '',
  riskLevel: '',
  maintenanceType: '',
  owner: '',
  dateRange: []
})

const applyQuery = () => {
  const q = route.query
  if (typeof q.keyword === 'string') filterForm.keyword = q.keyword
  if (typeof q.status === 'string') filterForm.status = q.status
  if (typeof q.riskLevel === 'string') filterForm.riskLevel = q.riskLevel
  if (typeof q.maintenanceType === 'string') filterForm.maintenanceType = q.maintenanceType
  if (typeof q.owner === 'string') filterForm.owner = q.owner
}

onMounted(() => {
  const view = store.loadView()
  const saved = view.workbench
  // URL query 优先（从看板卡片跳转时携带筛选条件）；否则恢复上次离开时的视图
  if (Object.keys(route.query).length > 0) {
    applyQuery()
  } else if (saved) {
    filterForm.keyword = saved.keyword || ''
    filterForm.status = saved.status || ''
    filterForm.riskLevel = saved.riskLevel || ''
    filterForm.maintenanceType = saved.maintenanceType || ''
    filterForm.owner = saved.owner || ''
    filterForm.dateRange = saved.dateRange || []
  }
})

watch(
  () => [
    filterForm.keyword,
    filterForm.status,
    filterForm.riskLevel,
    filterForm.maintenanceType,
    filterForm.owner,
    JSON.stringify(filterForm.dateRange)
  ],
  () => {
    const view = store.loadView()
    store.saveView({
      ...view,
      workbench: {
        keyword: filterForm.keyword,
        status: filterForm.status,
        riskLevel: filterForm.riskLevel,
        maintenanceType: filterForm.maintenanceType,
        owner: filterForm.owner,
        dateRange: filterForm.dateRange
      }
    })
  }
)

const filteredPlans = computed(() => {
  let list = [...store.planList]
  if (filterForm.keyword) {
    const k = filterForm.keyword.trim()
    list = list.filter(
      (p) => p.equipmentName.includes(k) || p.equipmentCode.includes(k)
    )
  }
  if (filterForm.maintenanceType) list = list.filter((p) => p.maintenanceType === filterForm.maintenanceType)
  if (filterForm.riskLevel) list = list.filter((p) => p.riskLevel === filterForm.riskLevel)
  if (filterForm.status) list = list.filter((p) => p.status === filterForm.status)
  if (filterForm.owner) {
    list = list.filter((p) => (filterForm.owner === '__none__' ? !p.owner : p.owner === filterForm.owner))
  }
  if (filterForm.dateRange && filterForm.dateRange.length === 2) {
    const [s, e] = filterForm.dateRange
    list = list.filter((p) => p.planDate >= s && p.planDate <= e)
  }
  // 风险随设备最新下次保养日期动态计算，完成后计划视图自动同步
  return list
    .map((p) => ({
      ...p,
      riskLevel: store.findEquipment(p.equipmentId)
        ? getRiskLevel(store.findEquipment(p.equipmentId)!.nextMaintenanceDate)
        : p.riskLevel
    }))
    .sort((a, b) => a.planDate.localeCompare(b.planDate))
})

const resetFilter = () => {
  filterForm.keyword = ''
  filterForm.status = ''
  filterForm.riskLevel = ''
  filterForm.maintenanceType = ''
  filterForm.owner = ''
  filterForm.dateRange = []
}

// ---------- 批量调整 ----------
const selected = ref<MaintenancePlan[]>([])
const batchOwner = ref('')
const batchCycle = ref<number | undefined>(undefined)
const batchOffset = ref<number | undefined>(undefined)

const selectedPlans = computed(() => selected.value)

const onSelectionChange = (rows: MaintenancePlan[]) => {
  selected.value = rows
}

const reportConflicts = (conflicts: PlanConflict[], action: string) => {
  if (conflicts.length === 0) {
    ElMessage.success(`${action}成功，未发现冲突`)
    return
  }
  lastResult.value = {
    created: 0,
    skipped: 0,
    conflicts,
    messages: []
  }
  resultVisible.value = true
  ElMessage.warning(`${action}已保存，但 ${conflicts.length} 项存在时间或负载冲突`)
}

const applyBatch = () => {
  if (batchOwner.value === '' && !batchCycle.value && batchOffset.value === undefined) {
    ElMessage.warning('请至少填写一项要批量调整的内容（负责人 / 周期 / 日期偏移）')
    return
  }
  const ids = selected.value.map((p) => p.id)
  try {
    const conflicts = store.batchUpdatePlans(ids, {
      owner: batchOwner.value || undefined,
      cycleDays: batchCycle.value || undefined,
      dateOffsetDays: batchOffset.value
    })
    reportConflicts(conflicts, '批量调整')
    batchOwner.value = ''
    batchCycle.value = undefined
    batchOffset.value = undefined
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '批量调整失败')
  }
}

const onOwnerInline = (row: MaintenancePlan, v: string) => {
  try {
    const conflicts = store.batchUpdatePlans([row.id], { owner: v })
    if (conflicts.length > 0) reportConflicts(conflicts, '负责人调整')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

const onCycleInline = (row: MaintenancePlan, v: number) => {
  try {
    store.batchUpdatePlans([row.id], { cycleDays: v })
    ElMessage.success('周期已更新')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

const handleCancel = (row: MaintenancePlan) => {
  ElMessageBox.confirm(`确定取消「${row.equipmentName}」的保养计划吗？`, '提示', {
    type: 'warning'
  })
    .then(() => {
      store.cancelPlan(row.id)
      ElMessage.success('计划已取消')
    })
    .catch(() => {})
}

const handleResetAll = () => {
  ElMessageBox.confirm('将清空全部计划与登记记录并恢复演示数据，确定继续？', '危险操作', {
    type: 'error'
  })
    .then(() => {
      store.resetAll()
      ElMessage.success('已恢复演示数据')
    })
    .catch(() => {})
}

// ---------- 完成维护 ----------
const completeVisible = ref(false)
const completeTarget = ref<MaintenancePlan | null>(null)
const completeFormRef = ref<FormInstance>()
const submitting = ref(false)
const completeForm = reactive({
  maintenancePerson: '',
  maintenanceContent: '',
  maintenanceResult: '完成',
  cost: 0,
  remark: ''
})

const completeRules: FormRules = {
  maintenancePerson: [{ required: true, message: '请输入维护人员', trigger: 'blur' }],
  maintenanceContent: [{ required: true, message: '请输入维护内容', trigger: 'blur' }],
  maintenanceResult: [{ required: true, message: '请选择维护结果', trigger: 'change' }]
}

const nextDatePreview = computed(() => {
  if (!completeTarget.value) return ''
  const d = new Date(todayStr)
  d.setDate(d.getDate() + completeTarget.value.cycleDays)
  return d.toISOString().split('T')[0]
})

const openComplete = (row: MaintenancePlan) => {
  completeTarget.value = row
  completeForm.maintenancePerson = row.owner || ''
  completeForm.maintenanceContent = ''
  completeForm.maintenanceResult = '完成'
  completeForm.cost = 0
  completeForm.remark = ''
  completeVisible.value = true
}

const submitComplete = () => {
  if (!completeFormRef.value || !completeTarget.value) return
  completeFormRef.value.validate((valid) => {
    if (!valid) return
    submitting.value = true
    setTimeout(() => {
      try {
        store.completePlan(completeTarget.value!, { ...completeForm })
        ElMessage.success('维护已完成，设备列表、逾期提醒和统计已同步更新')
        completeVisible.value = false
      } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : '保存失败')
      } finally {
        submitting.value = false
      }
    }, 300)
  })
}

// ---------- 维护记录 ----------
const recordVisible = ref(false)
const recordTarget = ref<MaintenancePlan | null>(null)
const planRecords = ref<MaintenanceRecord[]>([])

const viewRecords = (row: MaintenancePlan) => {
  recordTarget.value = row
  planRecords.value = store.recordsOf(row.equipmentId)
  recordVisible.value = true
}

// ---------- 展示辅助 ----------
const riskOf = (date: string): RiskLevel => getRiskLevel(date)

const riskTagType = (level: RiskLevel) =>
  ({ 逾期: 'danger', 临期: 'warning', 正常: 'success' })[level] as 'danger' | 'warning' | 'success'

const statusTagType = (status: string) =>
  ({
    待安排: 'info',
    已安排: 'primary',
    进行中: 'warning',
    已完成: 'success',
    已取消: 'info'
  })[status] || 'info'

const maintenanceTypeColor = (type: string) =>
  ({
    常规维护: 'info',
    故障维修: 'danger',
    定期保养: 'success',
    紧急维修: 'warning'
  })[type] || 'info'

const resultColor = (result: string) =>
  ({ 完成: 'success', 进行中: 'warning', 待跟进: 'danger' })[result] || 'info'

const goBoard = () => router.push('/maintenance/board')
</script>

<style scoped lang="scss">
.workbench-container {
  width: 100%;
}

.mb-20 {
  margin-bottom: 20px;
}

.mt-15 {
  margin-top: 15px;
}

.mr-10 {
  margin-right: 10px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.gen-form {
  .cycle-unit {
    margin-left: 8px;
    color: #64748b;
  }

  .gen-tips {
    padding-left: 100px;
    margin-bottom: 12px;
  }
}

.filter-form {
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
}

.conflict-tip {
  max-width: 320px;
  line-height: 1.6;
}

.form-hint {
  margin-left: 10px;
  color: #94a3b8;
  font-size: 12px;
}

.record-info {
  padding: 10px;
  background: #f8fafc;
  border-radius: 8px;

  .label {
    color: #64748b;
  }

  .value {
    font-weight: 600;
    color: #1e293b;
  }
}

.result-body {
  max-height: 320px;
  overflow-y: auto;
  padding: 0 20px;
}
</style>
