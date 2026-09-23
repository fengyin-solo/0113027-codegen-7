<template>
  <div class="plan-container">
    <!-- 风险概览：点击卡片按风险筛选 -->
    <el-row :gutter="16" class="mb-20">
      <el-col :span="6" v-for="card in riskCards" :key="card.key">
        <div class="risk-card" :class="card.cls" @click="toggleRiskFilter(card.key)">
          <div class="risk-value">{{ card.count }}</div>
          <div class="risk-label">{{ card.label }}</div>
        </div>
      </el-col>
    </el-row>

    <el-card class="mb-20">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="关键字">
          <el-input v-model="filters.keyword" placeholder="设备名称 / 编码" clearable @input="saveUiState" style="width: 160px" />
        </el-form-item>
        <el-form-item label="设备类型">
          <el-select v-model="filters.equipmentType" placeholder="全部" clearable @change="saveUiState" style="width: 120px">
            <el-option v-for="t in equipmentTypeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="维护类型">
          <el-select v-model="filters.maintenanceType" placeholder="全部" clearable @change="saveUiState" style="width: 120px">
            <el-option v-for="t in MAINTENANCE_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="逾期风险">
          <el-select v-model="filters.risk" placeholder="全部" clearable @change="saveUiState" style="width: 130px">
            <el-option label="已逾期" value="overdue" />
            <el-option label="7天内到期" value="soon" />
            <el-option label="30天内到期" value="upcoming" />
            <el-option label="正常" value="normal" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="filters.assignee" placeholder="全部" clearable filterable @change="saveUiState" style="width: 110px">
            <el-option v-for="a in assigneeOptions" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" @change="handleStatusChange" style="width: 110px">
            <el-option label="待执行" value="pending" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
            <el-option label="全部" value="" />
          </el-select>
        </el-form-item>
        <el-form-item label="计划日期">
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            @change="saveUiState"
          />
        </el-form-item>
        <el-form-item label="分组">
          <el-radio-group v-model="groupBy" size="small" @change="saveUiState">
            <el-radio-button label="none">不分组</el-radio-button>
            <el-radio-button label="equipment">按设备</el-radio-button>
            <el-radio-button label="type">按类型</el-radio-button>
            <el-radio-button label="risk">按风险</el-radio-button>
            <el-radio-button label="assignee">按负责人</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" @click="openGenerateDialog">
            <el-icon style="vertical-align: -2px"><Plus /></el-icon> 生成保养计划
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 批量操作条：勾选后出现 -->
    <el-card v-if="selectedPendingPlans.length" class="mb-20 batch-bar" shadow="always">
      <div class="batch-inner">
        <span>已选 <b>{{ selectedPendingPlans.length }}</b> 项待执行计划</span>
        <span class="batch-tip">（已完成 / 已取消的计划不参与批量调整）</span>
        <div class="ml-auto">
          <el-button type="primary" size="small" @click="openBatchAssignee">批量调整负责人</el-button>
          <el-button type="warning" size="small" @click="openBatchCycle">批量调整周期</el-button>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>保养计划（{{ filteredPlans.length }}）</span>
          <el-button text size="small" @click="router.push('/equipment/overview')">返回概览看板</el-button>
        </div>
      </template>
      <el-table
        :data="tableRows"
        border
        stripe
        row-key="rowKey"
        :tree-props="{ children: 'children' }"
        :row-class-name="rowClassName"
        :selectable="(row: PlanRow) => !row._isGroup"
        @selection-change="handleSelectionChange"
        :default-expand-all="true"
      >
        <el-table-column type="selection" width="45" reserve-selection />
        <el-table-column label="设备 / 分组" min-width="200">
          <template #default="{ row }: { row: PlanRow }">
            <template v-if="row._isGroup">
              <span class="group-label">{{ row.groupLabel }}</span>
              <el-tag size="small" type="info" round class="ml-10">{{ row.children?.length }}</el-tag>
            </template>
            <template v-else>
              <div class="device-cell">
                <span class="device-name">{{ row.equipmentName }}</span>
                <span class="device-code">{{ row.equipmentCode }}</span>
              </div>
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="equipmentType" label="设备类型" width="100">
          <template #default="{ row }">{{ row._isGroup ? '' : row.equipmentType }}</template>
        </el-table-column>
        <el-table-column prop="maintenanceType" label="维护类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="!row._isGroup" size="small">{{ row.maintenanceType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="plannedDate" label="计划保养日期" width="130">
          <template #default="{ row }">
            <template v-if="!row._isGroup">
              <span :class="{ 'text-danger': row.status === 'pending' && riskOf(row) === 'overdue' }">{{ row.plannedDate }}</span>
              <el-tag v-if="row.status === 'pending'" :type="RISK_META[riskOf(row)].tagType" size="small" class="ml-5">
                {{ RISK_META[riskOf(row)].label }}
              </el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="周期(天)" width="90">
          <template #default="{ row }">
            <span v-if="!row._isGroup">{{ row.cycleDays > 0 ? row.cycleDays : '一次性' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="assignee" label="负责人" width="90">
          <template #default="{ row }">{{ row._isGroup ? '' : row.assignee }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="!row._isGroup" :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="保养内容" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row._isGroup ? '' : row.content }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <template v-if="!row._isGroup">
              <el-button v-if="row.status === 'pending'" type="success" size="small" link @click="openComplete(row)">完成维护</el-button>
              <el-button v-if="row.status === 'pending'" type="primary" size="small" link @click="openEdit(row)">编辑</el-button>
              <el-button type="info" size="small" link @click="openRecords(row)">记录</el-button>
              <el-dropdown v-if="row.status === 'pending'" trigger="click" @command="(cmd: string) => handleRowCommand(cmd, row)">
                <el-button type="danger" size="small" link>更多<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="cancel">取消计划</el-dropdown-item>
                    <el-dropdown-item command="delete">删除计划</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="emptyDescription">
            <el-button v-if="store.plans.length" type="primary" @click="resetFilters">清除筛选条件</el-button>
            <el-button v-else type="primary" @click="openGenerateDialog">立即生成保养计划</el-button>
          </el-empty>
        </template>
      </el-table>
    </el-card>

    <!-- 生成保养计划 -->
    <el-dialog v-model="generateVisible" title="生成保养计划" width="640px" :close-on-click-modal="false">
      <el-form :model="genForm" :rules="genRules" ref="genFormRef" label-width="110px">
        <el-form-item label="选择设备" required>
          <div class="device-picker">
            <el-select
              v-model="genForm.equipmentIds"
              multiple
              collapse-tags
              collapse-tags-tooltip
              placeholder="请选择需要保养的设备"
              style="width: 100%"
            >
              <el-option
                v-for="eq in store.equipmentList"
                :key="eq.id"
                :label="`${eq.equipmentName}（下次保养 ${eq.nextMaintenanceDate}）`"
                :value="eq.id"
              >
                <span>{{ eq.equipmentName }} · {{ eq.equipmentType }}</span>
                <el-tag
                  size="small"
                  :type="RISK_META[getRiskLevel(eq.nextMaintenanceDate)].tagType"
                  class="ml-10"
                >{{ RISK_META[getRiskLevel(eq.nextMaintenanceDate)].label }}</el-tag>
              </el-option>
            </el-select>
            <div class="quick-row">
              <el-button link type="primary" size="small" @click="quickSelect('overdue')">全选逾期设备</el-button>
              <el-button link type="primary" size="small" @click="quickSelect('soon')">全选7天内到期</el-button>
              <el-button link type="primary" size="small" @click="quickSelect('upcoming')">全选30天内到期</el-button>
              <el-button link size="small" @click="genForm.equipmentIds = []">清空</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="维护类型" prop="maintenanceType">
          <el-select v-model="genForm.maintenanceType" placeholder="请选择维护类型" style="width: 100%" @change="onGenTypeChange">
            <el-option v-for="t in MAINTENANCE_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="计划日期" prop="dateMode">
          <el-radio-group v-model="genForm.dateMode">
            <el-radio label="perDevice">按各设备下次保养日期</el-radio>
            <el-radio label="unified">统一指定日期</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="genForm.dateMode === 'unified'" label="统一日期" prop="unifiedDate">
          <el-date-picker v-model="genForm.unifiedDate" type="date" placeholder="选择计划日期" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="保养周期(天)" prop="cycleDays">
          <el-input-number v-model="genForm.cycleDays" :min="0" :max="3650" />
          <span class="form-tip ml-10">0 表示一次性保养（如故障/紧急维修）</span>
        </el-form-item>
        <el-form-item label="负责人" prop="assignee">
          <el-select v-model="genForm.assignee" placeholder="请选择或输入负责人" filterable allow-create default-first-option style="width: 100%">
            <el-option v-for="a in DEFAULT_ASSIGNEES" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="保养内容" prop="content">
          <el-input v-model="genForm.content" type="textarea" :rows="3" placeholder="请输入保养内容" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="genForm.remark" type="textarea" :rows="2" placeholder="备注信息（可选）" />
        </el-form-item>

        <!-- 生成预览：提前暴露时间冲突 / 重复计划 -->
        <el-form-item v-if="genForm.equipmentIds.length" label="生成预览">
          <el-table :data="genPreview" size="small" border max-height="200">
            <el-table-column prop="equipmentName" label="设备" width="130" />
            <el-table-column prop="date" label="计划日期" width="120" />
            <el-table-column label="结果" min-width="220">
              <template #default="{ row }">
                <el-tag v-if="row.kind === 'ok'" type="success" size="small">将生成</el-tag>
                <el-tag v-else-if="row.kind === 'dup'" type="warning" size="small">重复跳过</el-tag>
                <el-tag v-else type="danger" size="small">时间冲突</el-tag>
                <span class="preview-reason">{{ row.reason }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateVisible = false">取消</el-button>
        <el-button type="primary" :loading="genLoading" @click="submitGenerate">生成计划</el-button>
      </template>
    </el-dialog>

    <!-- 编辑单个计划 -->
    <el-dialog v-model="editVisible" title="编辑保养计划" width="520px" :close-on-click-modal="false">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="设备" required>
          <el-select v-model="editForm.equipmentId" style="width: 100%">
            <el-option v-for="eq in store.equipmentList" :key="eq.id" :label="`${eq.equipmentName}（${eq.equipmentCode}）`" :value="eq.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="维护类型" required>
          <el-select v-model="editForm.maintenanceType" style="width: 100%" @change="onEditTypeChange">
            <el-option v-for="t in MAINTENANCE_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="计划日期" required>
          <el-date-picker v-model="editForm.plannedDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="负责人" required>
          <el-select v-model="editForm.assignee" filterable allow-create default-first-option style="width: 100%">
            <el-option v-for="a in DEFAULT_ASSIGNEES" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="周期(天)">
          <el-input-number v-model="editForm.cycleDays" :min="0" :max="3650" />
        </el-form-item>
        <el-form-item label="保养内容">
          <el-input v-model="editForm.content" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量调整负责人 -->
    <el-dialog v-model="batchAssigneeVisible" title="批量调整负责人" width="420px" :close-on-click-modal="false">
      <el-form label-width="100px">
        <el-form-item label="计划数量">
          <span>{{ selectedPendingPlans.length }} 项待执行计划</span>
        </el-form-item>
        <el-form-item label="新负责人" required>
          <el-select v-model="batchAssignee" placeholder="请选择或输入负责人" filterable allow-create default-first-option style="width: 100%">
            <el-option v-for="a in DEFAULT_ASSIGNEES" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchAssigneeVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchLoading" @click="submitBatchAssignee">确定调整</el-button>
      </template>
    </el-dialog>

    <!-- 批量调整周期 -->
    <el-dialog v-model="batchCycleVisible" title="批量调整保养周期" width="460px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" class="mb-20"
        title="将按各设备上次保养日期 + 新周期重算计划日期（已过期则排到今天）；一次性保养（周期0）不重排日期。若发生时间冲突，本批调整全部不会保存。" />
      <el-form label-width="100px">
        <el-form-item label="计划数量">
          <span>{{ selectedPendingPlans.length }} 项待执行计划</span>
        </el-form-item>
        <el-form-item label="新周期(天)" required>
          <el-input-number v-model="batchCycleDays" :min="0" :max="3650" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchCycleVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchLoading" @click="submitBatchCycle">确定调整</el-button>
      </template>
    </el-dialog>

    <!-- 完成维护 -->
    <MaintenanceDialog v-model="completeVisible" :equipment-id="completeEquipmentId" :plan="completePlan" />

    <!-- 维护记录 -->
    <el-dialog v-model="recordsVisible" title="维护记录" width="760px">
      <div class="record-info">
        <span class="label">设备：</span>
        <span class="value">{{ recordsEquipment?.equipmentName }}</span>
        <span class="label ml-20">编码：</span>
        <span class="value">{{ recordsEquipment?.equipmentCode }}</span>
        <el-button class="ml-20" type="primary" size="small" @click="registerFromRecords">维护登记</el-button>
      </div>
      <el-table :data="recordsList" border stripe style="width: 100%; margin-top: 15px" max-height="380">
        <el-table-column prop="maintenanceDate" label="维护日期" width="110" />
        <el-table-column prop="maintenanceType" label="类型" width="100">
          <template #default="{ row }"><el-tag size="small">{{ row.maintenanceType }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="maintenancePerson" label="人员" width="80" />
        <el-table-column prop="maintenanceContent" label="维护内容" min-width="180" show-overflow-tooltip />
        <el-table-column prop="maintenanceResult" label="结果" width="90">
          <template #default="{ row }">
            <el-tag :type="row.maintenanceResult === '完成' ? 'success' : 'warning'" size="small">{{ row.maintenanceResult }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="cost" label="费用" width="80">
          <template #default="{ row }">{{ row.cost || '-' }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="该设备暂无维护记录" :image-size="80" />
        </template>
      </el-table>
      <template #footer>
        <el-button @click="recordsVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import {
  useMaintenanceStore,
  MAINTENANCE_TYPES,
  DEFAULT_ASSIGNEES,
  DEFAULT_CYCLE,
  DEFAULT_PLAN_CONTENT,
  RISK_META,
  getRiskLevel,
  todayStr
} from '@/store/modules/maintenance'
import type { MaintenancePlan, PlanStatus, RiskLevel } from '@/api/equipment'
import MaintenanceDialog from '@/components/MaintenanceDialog.vue'

const router = useRouter()
const route = useRoute()
const store = useMaintenanceStore()

// ---------------- 工作台视图持久化（重新进入后保留） ----------------
const UI_KEY = 'wlms_plan_workbench_ui'

interface Filters {
  keyword: string
  equipmentType: string
  maintenanceType: string
  risk: '' | RiskLevel
  assignee: string
  status: '' | PlanStatus
  dateRange: string[]
}

const defaultFilters = (): Filters => ({
  keyword: '',
  equipmentType: '',
  maintenanceType: '',
  risk: '',
  assignee: '',
  status: 'pending',
  dateRange: []
})

const filters = reactive<Filters>(defaultFilters())
const groupBy = ref<'none' | 'equipment' | 'type' | 'risk' | 'assignee'>('equipment')

const saveUiState = () => {
  localStorage.setItem(UI_KEY, JSON.stringify({ filters: { ...filters }, groupBy: groupBy.value }))
}

const loadUiState = () => {
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved.filters) Object.assign(filters, saved.filters)
      if (saved.groupBy) groupBy.value = saved.groupBy
    }
  } catch {
    /* ignore */
  }
}

loadUiState()

// 从概览卡片跳转时按状态/风险定位（仅本次进入生效）
onMounted(() => {
  if (route.query.status) {
    const s = String(route.query.status)
    filters.status = (['pending', 'completed', 'cancelled'].includes(s) ? s : '') as Filters['status']
    saveUiState()
  }
  if (route.query.risk) {
    filters.risk = String(route.query.risk) as RiskLevel
    saveUiState()
  }
})

// ---------------- 筛选项 ----------------
const equipmentTypeOptions = computed(() =>
  Array.from(new Set(store.equipmentList.map(e => e.equipmentType)))
)
const assigneeOptions = computed(() =>
  Array.from(new Set([...DEFAULT_ASSIGNEES, ...store.plans.map(p => p.assignee)]))
)

const filteredPlans = computed(() => {
  let list = [...store.plans]
  if (filters.status) list = list.filter(p => p.status === filters.status)
  if (filters.keyword) {
    const kw = filters.keyword.trim()
    list = list.filter(p => p.equipmentName.includes(kw) || p.equipmentCode.includes(kw))
  }
  if (filters.equipmentType) list = list.filter(p => p.equipmentType === filters.equipmentType)
  if (filters.maintenanceType) list = list.filter(p => p.maintenanceType === filters.maintenanceType)
  if (filters.assignee) list = list.filter(p => p.assignee === filters.assignee)
  if (filters.risk) {
    list = list.filter(p => p.status === 'pending' && getRiskLevel(p.plannedDate) === filters.risk)
  }
  if (filters.dateRange.length === 2) {
    const [start, end] = filters.dateRange
    list = list.filter(p => p.plannedDate >= start && p.plannedDate <= end)
  }
  return list.sort((a, b) => b.plannedDate.localeCompare(a.plannedDate) === 0
    ? a.id - b.id
    : a.plannedDate.localeCompare(b.plannedDate))
})

const riskOf = (plan: MaintenancePlan): RiskLevel =>
  plan.status === 'pending' ? getRiskLevel(plan.plannedDate) : 'normal'

const statusLabel = (s: PlanStatus) => ({ pending: '待执行', completed: '已完成', cancelled: '已取消' })[s]
const statusTagType = (s: PlanStatus): 'warning' | 'success' | 'info' =>
  ({ pending: 'warning', completed: 'success', cancelled: 'info' } as const)[s]

// 风险卡片（统计全部待执行计划，与筛选无关）
const riskCards = computed(() => {
  const pending = store.pendingPlans
  const count = (key: RiskLevel) => pending.filter(p => getRiskLevel(p.plannedDate) === key).length
  return [
    { key: 'overdue' as RiskLevel, label: '已逾期', count: count('overdue'), cls: 'is-danger' },
    { key: 'soon' as RiskLevel, label: '7天内到期', count: count('soon'), cls: 'is-warning' },
    { key: 'upcoming' as RiskLevel, label: '30天内到期', count: count('upcoming'), cls: 'is-primary' },
    { key: 'normal' as RiskLevel, label: '正常计划', count: count('normal'), cls: 'is-info' }
  ]
})

const toggleRiskFilter = (key: RiskLevel) => {
  filters.status = 'pending'
  filters.risk = filters.risk === key ? '' : key
  saveUiState()
}

const handleStatusChange = () => {
  if (filters.status !== 'pending') filters.risk = ''
  saveUiState()
}

const resetFilters = () => {
  Object.assign(filters, defaultFilters())
  saveUiState()
}

// ---------------- 分组树表 ----------------
interface PlanRow extends MaintenancePlan {
  _isGroup?: boolean
  groupLabel?: string
  children?: PlanRow[]
  rowKey: string
}

const tableRows = computed<PlanRow[]>(() => {
  const plans = filteredPlans.value
  if (groupBy.value === 'none') {
    return plans.map(p => ({ ...p, rowKey: `plan-${p.id}` }))
  }

  const groups = new Map<string, PlanRow>()
  const riskOrder: RiskLevel[] = ['overdue', 'soon', 'upcoming', 'normal']

  for (const p of plans) {
    let key = ''
    let label = ''
    if (groupBy.value === 'equipment') {
      key = `eq-${p.equipmentId}`
      label = `${p.equipmentName}（${p.equipmentCode}）`
    } else if (groupBy.value === 'type') {
      key = `type-${p.maintenanceType}`
      label = p.maintenanceType
    } else if (groupBy.value === 'assignee') {
      key = `as-${p.assignee}`
      label = `负责人：${p.assignee}`
    } else {
      // 按风险：仅待执行计划有风险，其余归入“已结束”
      if (p.status === 'pending') {
        const r = getRiskLevel(p.plannedDate)
        key = `risk-${r}`
        label = RISK_META[r].label
      } else {
        key = 'risk-closed'
        label = '已结束（完成 / 取消）'
      }
    }
    if (!groups.has(key)) {
      groups.set(key, { ...p, rowKey: `group-${key}`, _isGroup: true, groupLabel: label, children: [] })
    }
    groups.get(key)!.children!.push({ ...p, rowKey: `plan-${p.id}` })
  }

  const arr = Array.from(groups.values())
  if (groupBy.value === 'risk') {
    arr.sort((a, b) => {
      const idx = (k: string) => {
        if (k === '已结束（完成 / 取消）') return 99
        return riskOrder.findIndex(r => RISK_META[r].label === k)
      }
      return idx(a.groupLabel || '') - idx(b.groupLabel || '')
    })
  } else if (groupBy.value === 'type') {
    arr.sort((a, b) =>
      MAINTENANCE_TYPES.indexOf(a.groupLabel || '') - MAINTENANCE_TYPES.indexOf(b.groupLabel || ''))
  } else {
    arr.sort((a, b) => (a.groupLabel || '').localeCompare(b.groupLabel || ''))
  }
  // 组内按日期升序
  arr.forEach(g => g.children!.sort((x, y) => x.plannedDate.localeCompare(y.plannedDate)))
  return arr
})

const rowClassName = ({ row }: { row: PlanRow }) => {
  if (row._isGroup) return 'group-row'
  if (row.status === 'pending' && getRiskLevel(row.plannedDate) === 'overdue') return 'overdue-row'
  return ''
}

const emptyDescription = computed(() =>
  store.plans.length ? '没有符合筛选条件的保养计划，请调整筛选条件' : '还没有任何保养计划，请先选择设备生成计划'
)

// ---------------- 多选 / 批量 ----------------
const selected = ref<MaintenancePlan[]>([])
const selectedPendingPlans = computed(() => selected.value.filter(p => p.status === 'pending'))

const handleSelectionChange = (rows: PlanRow[]) => {
  selected.value = rows.filter(r => !r._isGroup) as MaintenancePlan[]
}

const batchLoading = ref(false)
const batchAssigneeVisible = ref(false)
const batchAssignee = ref('')
const batchCycleVisible = ref(false)
const batchCycleDays = ref(30)

const openBatchAssignee = () => {
  batchAssignee.value = selectedPendingPlans.value[0]?.assignee || ''
  batchAssigneeVisible.value = true
}

const submitBatchAssignee = () => {
  if (!batchAssignee.value.trim()) {
    ElMessage.warning('请选择新的负责人')
    return
  }
  batchLoading.value = true
  setTimeout(() => {
    try {
      const { updated } = store.batchAdjust({
        planIds: selectedPendingPlans.value.map(p => p.id),
        assignee: batchAssignee.value
      })
      ElMessage.success(`已批量调整 ${updated} 项计划的负责人`)
      batchAssigneeVisible.value = false
    } catch (e: any) {
      ElMessage.error(e?.message || '批量调整失败，请稍后重试')
    } finally {
      batchLoading.value = false
    }
  }, 300)
}

const openBatchCycle = () => {
  batchCycleDays.value = selectedPendingPlans.value[0]?.cycleDays || 30
  batchCycleVisible.value = true
}

const submitBatchCycle = () => {
  batchLoading.value = true
  setTimeout(() => {
    try {
      const { updated, skipped } = store.batchAdjust({
        planIds: selectedPendingPlans.value.map(p => p.id),
        cycleDays: batchCycleDays.value
      })
      if (skipped.length) {
        ElMessage.warning(`已更新 ${updated} 项；${skipped.length} 项一次性保养未重排日期（${skipped.map(s => s.name).join('、')}）`)
      } else {
        ElMessage.success(`已批量调整 ${updated} 项计划的周期并重排计划日期`)
      }
      batchCycleVisible.value = false
    } catch (e: any) {
      // 时间冲突等原因：store 已保证整批回滚，未保存任何内容
      ElMessage.error(e?.message || '批量调整失败，请稍后重试')
    } finally {
      batchLoading.value = false
    }
  }, 300)
}

// ---------------- 生成计划弹窗 ----------------
const generateVisible = ref(false)
const genLoading = ref(false)
const genFormRef = ref<FormInstance>()

const genForm = reactive({
  equipmentIds: [] as number[],
  maintenanceType: '常规维护',
  dateMode: 'perDevice' as 'perDevice' | 'unified',
  unifiedDate: todayStr(),
  cycleDays: DEFAULT_CYCLE['常规维护'],
  assignee: '',
  content: DEFAULT_PLAN_CONTENT['常规维护'],
  remark: ''
})

const genRules = {
  maintenanceType: [{ required: true, message: '请选择维护类型', trigger: 'change' }],
  unifiedDate: [{ required: true, message: '请选择统一日期', trigger: 'change' }],
  assignee: [{ required: true, message: '请指定负责人', trigger: 'change' }],
  content: [{ required: true, message: '请填写保养内容', trigger: 'blur' }]
}

const openGenerateDialog = () => {
  if (!store.equipmentList.length) {
    ElMessage.warning('当前没有任何设备，无法生成保养计划。请先在「设备列表」中新增设备。')
    return
  }
  genForm.equipmentIds = []
  genForm.maintenanceType = '常规维护'
  genForm.dateMode = 'perDevice'
  genForm.unifiedDate = todayStr()
  genForm.cycleDays = DEFAULT_CYCLE['常规维护']
  genForm.assignee = ''
  genForm.content = DEFAULT_PLAN_CONTENT['常规维护']
  genForm.remark = ''
  generateVisible.value = true
}

const onGenTypeChange = () => {
  genForm.cycleDays = DEFAULT_CYCLE[genForm.maintenanceType] ?? 30
  genForm.content = DEFAULT_PLAN_CONTENT[genForm.maintenanceType] || ''
}

const quickSelect = (risk: RiskLevel) => {
  genForm.equipmentIds = store.equipmentList
    .filter(e => getRiskLevel(e.nextMaintenanceDate) === risk)
    .map(e => e.id)
  if (!genForm.equipmentIds.length) ElMessage.info(`没有「${RISK_META[risk].label}」的设备`)
}

// 预览行
interface PreviewRow {
  equipmentId: number
  equipmentName: string
  date: string
  kind: 'ok' | 'dup' | 'conflict'
  reason: string
}

const genPreview = computed<PreviewRow[]>(() =>
  genForm.equipmentIds.map(id => {
    const eq = store.getEquipment(id)
    const date = genForm.dateMode === 'perDevice' ? eq?.nextMaintenanceDate || '' : genForm.unifiedDate
    if (!eq) return { equipmentId: id, equipmentName: `#${id}`, date, kind: 'conflict', reason: '设备不存在' }
    const dup = store.plans.find(
      p => p.status === 'pending' && p.equipmentId === id &&
        p.maintenanceType === genForm.maintenanceType && p.plannedDate === date
    )
    if (dup) return { equipmentId: id, equipmentName: eq.equipmentName, date, kind: 'dup', reason: `当天已有同类型待执行计划（#${dup.id}）` }
    const conflict = store.findConflict(id, date)
    if (conflict) return { equipmentId: id, equipmentName: eq.equipmentName, date, kind: 'conflict', reason: `当天已有「${conflict.maintenanceType}」计划（#${conflict.id}）` }
    return { equipmentId: id, equipmentName: eq.equipmentName, date, kind: 'ok', reason: '将新建待执行计划' }
  })
)

const submitGenerate = () => {
  if (!genForm.equipmentIds.length) {
    ElMessage.warning('请至少选择一台设备；若无设备可选，请先在设备列表中新增设备')
    return
  }
  if (genForm.dateMode === 'unified' && !genForm.unifiedDate) {
    ElMessage.warning('请选择统一计划日期')
    return
  }
  // 预览中已发现冲突时直接说明原因，避免提交失败
  const conflictRow = genPreview.value.find(r => r.kind === 'conflict')
  if (conflictRow) {
    ElMessage.error(`时间冲突：设备「${conflictRow.equipmentName}」在 ${conflictRow.date} 已有其他待执行计划，请调整日期或设备`)
    return
  }

  genLoading.value = true
  // 逐设备解析日期（按各设备下次保养日期 / 统一日期），store 内部事务保护：
  // 发生时间冲突会整批回滚，不会只保存一部分
  const items = genForm.equipmentIds.map(id => ({
    equipmentId: id,
    plannedDate: genForm.dateMode === 'perDevice'
      ? store.getEquipment(id)?.nextMaintenanceDate || ''
      : genForm.unifiedDate
  }))

  setTimeout(() => {
    try {
      const results = store.generatePlans({
        equipmentIds: genForm.equipmentIds,
        items,
        maintenanceType: genForm.maintenanceType,
        plannedDate: genForm.unifiedDate,
        assignee: genForm.assignee,
        cycleDays: genForm.cycleDays,
        content: genForm.content,
        remark: genForm.remark
      })
      const created = results.filter(r => r.success).length
      const skipped = results.filter(r => !r.success)
      if (created && !skipped.length) {
        ElMessage.success(`成功生成 ${created} 项保养计划`)
      } else if (created) {
        ElMessage.warning(`生成 ${created} 项，跳过 ${skipped.length} 项重复计划：${skipped.map(s => `${s.equipmentName}（${s.reason}）`).join('；')}`)
      } else {
        ElMessage.warning(`未生成任何计划，所选设备均已存在相同计划：${skipped.map(s => s.equipmentName).join('、')}`)
      }
      generateVisible.value = false
      selected.value = []
    } catch (e: any) {
      // 时间冲突 / 无设备 / 存储失败等原因，store 已保证不落库
      ElMessage.error(e?.message || '保存失败，请稍后重试')
    } finally {
      genLoading.value = false
    }
  }, 400)
}

// ---------------- 编辑计划 ----------------
const editVisible = ref(false)
const editingId = ref<number | null>(null)
const editForm = reactive({
  equipmentId: 0,
  maintenanceType: '常规维护',
  plannedDate: todayStr(),
  assignee: '',
  cycleDays: 30,
  content: '',
  remark: ''
})

const openEdit = (plan: MaintenancePlan) => {
  editingId.value = plan.id
  editForm.equipmentId = plan.equipmentId
  editForm.maintenanceType = plan.maintenanceType
  editForm.plannedDate = plan.plannedDate
  editForm.assignee = plan.assignee
  editForm.cycleDays = plan.cycleDays
  editForm.content = plan.content
  editForm.remark = plan.remark || ''
  editVisible.value = true
}

const onEditTypeChange = () => {
  editForm.cycleDays = DEFAULT_CYCLE[editForm.maintenanceType] ?? 30
}

const submitEdit = () => {
  if (!editForm.equipmentId) {
    ElMessage.warning('请选择设备')
    return
  }
  try {
    const res = store.savePlan({ id: editingId.value!, ...editForm })
    if (res.success) {
      ElMessage.success(res.message)
      editVisible.value = false
    } else {
      ElMessage.error(res.message)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败，请稍后重试')
  }
}

// ---------------- 行操作 ----------------
const handleRowCommand = (command: string, row: MaintenancePlan) => {
  if (command === 'cancel') {
    ElMessageBox.confirm(`确定取消「${row.equipmentName}」${row.plannedDate} 的${row.maintenanceType}计划吗？`, '取消计划', {
      type: 'warning',
      confirmButtonText: '确定取消',
      cancelButtonText: '再想想'
    }).then(() => {
      try {
        store.cancelPlan(row.id)
        ElMessage.success('计划已取消')
      } catch (e: any) {
        ElMessage.error(e?.message || '操作失败')
      }
    }).catch(() => {})
  } else if (command === 'delete') {
    ElMessageBox.confirm(`确定删除「${row.equipmentName}」的该计划吗？删除后不可恢复（维护记录不受影响）。`, '删除计划', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '保留'
    }).then(() => {
      try {
        store.deletePlan(row.id)
        ElMessage.success('计划已删除')
      } catch (e: any) {
        ElMessage.error(e?.message || '删除失败')
      }
    }).catch(() => {})
  }
}

// ---------------- 完成维护 ----------------
const completeVisible = ref(false)
const completeEquipmentId = ref<number | null>(null)
const completePlan = ref<MaintenancePlan | null>(null)

const openComplete = (plan: MaintenancePlan) => {
  completePlan.value = plan
  completeEquipmentId.value = plan.equipmentId
  completeVisible.value = true
}

// ---------------- 维护记录查询 ----------------
const recordsVisible = ref(false)
const recordsEquipmentId = ref<number | null>(null)
const recordsEquipment = computed(() =>
  recordsEquipmentId.value ? store.getEquipment(recordsEquipmentId.value) : undefined
)
const recordsList = computed(() =>
  recordsEquipmentId.value ? store.getRecords(recordsEquipmentId.value) : []
)

const openRecords = (plan: MaintenancePlan) => {
  recordsEquipmentId.value = plan.equipmentId
  recordsVisible.value = true
}

const registerFromRecords = () => {
  if (!recordsEquipmentId.value) return
  completePlan.value = null
  completeEquipmentId.value = recordsEquipmentId.value
  recordsVisible.value = false
  completeVisible.value = true
}
</script>

<style scoped lang="scss">
.plan-container {
  width: 100%;
}

.risk-card {
  padding: 18px;
  border-radius: 8px;
  background: #fff;
  border-left: 4px solid #94a3b8;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
  }

  .risk-value {
    font-size: 28px;
    font-weight: 700;
    color: #1e293b;
  }

  .risk-label {
    font-size: 13px;
    color: #64748b;
    margin-top: 4px;
  }

  &.is-danger {
    border-left-color: #ef4444;
    .risk-value { color: #ef4444; }
  }
  &.is-warning {
    border-left-color: #f59e0b;
    .risk-value { color: #f59e0b; }
  }
  &.is-primary {
    border-left-color: #3b82f6;
    .risk-value { color: #3b82f6; }
  }
  &.is-info {
    border-left-color: #22c55e;
    .risk-value { color: #22c55e; }
  }
}

.mb-20 {
  margin-bottom: 20px;
}

.ml-10 {
  margin-left: 10px;
}

.ml-20 {
  margin-left: 20px;
}

.ml-auto {
  margin-left: auto;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.filter-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
    margin-right: 16px;
  }
}

.batch-bar {
  border-left: 4px solid #3b82f6;
}

.batch-inner {
  display: flex;
  align-items: center;
  gap: 8px;

  .batch-tip {
    color: #94a3b8;
    font-size: 12px;
  }
}

.group-row {
  background: #f1f5f9 !important;

  :deep(.cell) {
    font-weight: 600;
  }
}

.overdue-row {
  :deep(td) {
    background-color: #fef2f2 !important;
  }
}

.device-cell {
  display: flex;
  flex-direction: column;

  .device-name {
    font-weight: 600;
  }
  .device-code {
    font-size: 12px;
    color: #94a3b8;
  }
}

.group-label {
  font-weight: 600;
}

.text-danger {
  color: #ef4444;
  font-weight: 600;
}

.form-tip {
  font-size: 12px;
  color: #94a3b8;
}

.device-picker {
  width: 100%;
}

.quick-row {
  margin-top: 4px;

  .el-button {
    margin-left: 0;
    padding: 2px 4px;
  }
}

.preview-reason {
  margin-left: 8px;
  font-size: 12px;
  color: #64748b;
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
</style>
