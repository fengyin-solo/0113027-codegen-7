<template>
  <div class="overview-container">
    <!-- 统计卡片：全部由 store getter 派生，完成维护后实时同步 -->
    <el-row :gutter="20" class="mb-20">
      <el-col :span="6">
        <div class="stat-card" @click="goWorkbench('')">
          <div class="stat-icon primary"><el-icon><Calendar /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ store.planStats.total }}</div>
            <div class="stat-label">全部计划</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card running" @click="goWorkbench('pending')">
          <div class="stat-icon running"><el-icon><Clock /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ store.planStats.pending }}</div>
            <div class="stat-label">待执行</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card danger" @click="goWorkbench('overdue')">
          <div class="stat-icon danger"><el-icon><WarningFilled /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ store.planStats.overdue }}</div>
            <div class="stat-label">逾期未完成</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card success" @click="goWorkbench('completed')">
          <div class="stat-icon success"><el-icon><CircleCheckFilled /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ store.planStats.completedThisMonth }}</div>
            <div class="stat-label">本月已完成</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mb-20">
      <el-col :span="10">
        <el-card class="h-full">
          <template #header>
            <span>逾期风险分布（待执行计划）</span>
          </template>
          <div ref="riskChart" class="chart-medium"></div>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card class="h-full">
          <template #header>
            <span>未来30天保养排期</span>
          </template>
          <div ref="scheduleChart" class="chart-medium"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="14">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>逾期 / 临期提醒</span>
              <div>
                <el-select v-model="riskFilter" size="small" style="width: 140px" @change="saveUiState">
                  <el-option label="全部风险" value="" />
                  <el-option v-for="m in riskFilterOptions" :key="m.value" :label="m.label" :value="m.value" />
                </el-select>
                <el-button type="primary" size="small" class="ml-10" @click="router.push('/equipment/plan')">前往工作台</el-button>
              </div>
            </div>
          </template>
          <el-table :data="filteredReminders" size="small" max-height="360" @row-click="(row: any) => openComplete(row)">
            <el-table-column prop="plannedDate" label="计划日期" width="115" />
            <el-table-column prop="equipmentName" label="设备" width="120" />
            <el-table-column prop="equipmentType" label="设备类型" width="90" />
            <el-table-column prop="maintenanceType" label="维护类型" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ row.maintenanceType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="风险" width="105">
              <template #default="{ row }: { row: (typeof filteredReminders.value)[number] }">
                <el-tag :type="RISK_META[row.risk].tagType" size="small">{{ RISK_META[row.risk].label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="assignee" label="负责人" width="80" />
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button type="success" size="small" link @click.stop="openComplete(row)">完成维护</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无符合条件的待执行计划" :image-size="80" />
            </template>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>近期维护记录</span>
              <el-button text size="small" @click="router.push('/equipment/list')">查看全部</el-button>
            </div>
          </template>
          <el-timeline v-if="recentRecords.length">
            <el-timeline-item
              v-for="rec in recentRecords"
              :key="rec.id"
              :timestamp="rec.maintenanceDate"
              type="success"
            >
              <div class="record-line">
                <span class="name">{{ rec.equipmentName }}</span>
                <el-tag size="small" type="info">{{ rec.maintenanceType }}</el-tag>
                <el-tag size="small" :type="rec.maintenanceResult === '完成' ? 'success' : 'warning'">{{ rec.maintenanceResult }}</el-tag>
              </div>
              <div class="record-sub">{{ rec.maintenancePerson }} · {{ rec.maintenanceContent }}</div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无维护记录" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <MaintenanceDialog v-model="dialogVisible" :equipment-id="dialogEquipmentId" :plan="dialogPlan" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { useMaintenanceStore, RISK_META } from '@/store/modules/maintenance'
import type { MaintenancePlan, RiskLevel } from '@/api/equipment'
import MaintenanceDialog from '@/components/MaintenanceDialog.vue'

const router = useRouter()
const store = useMaintenanceStore()

const UI_KEY = 'wlms_maintenance_overview_ui'
const riskFilter = ref<string>('')

// 重新进入后保留看板视图状态
const loadUiState = () => {
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      riskFilter.value = parsed.riskFilter || ''
    }
  } catch {
    /* ignore */
  }
}
const saveUiState = () => {
  localStorage.setItem(UI_KEY, JSON.stringify({ riskFilter: riskFilter.value }))
}
loadUiState()

interface RiskFilterOption {
  label: string
  value: RiskLevel
}
const riskFilterOptions: RiskFilterOption[] = [
  { label: '已逾期', value: 'overdue' },
  { label: '7天内到期', value: 'soon' },
  { label: '30天内到期', value: 'upcoming' },
  { label: '正常', value: 'normal' }
]

const filteredReminders = computed(() =>
  riskFilter.value ? store.reminders.filter(r => r.risk === riskFilter.value) : store.reminders
)

const recentRecords = computed(() => store.getRecords().slice(0, 6))

const goWorkbench = (status: string) => {
  router.push({ path: '/equipment/plan', query: status ? { status } : {} })
}

// ---------------- 完成维护 ----------------
const dialogVisible = ref(false)
const dialogEquipmentId = ref<number | null>(null)
const dialogPlan = ref<MaintenancePlan | null>(null)

const openComplete = (plan: MaintenancePlan) => {
  dialogPlan.value = plan
  dialogEquipmentId.value = plan.equipmentId
  dialogVisible.value = true
}

// ---------------- 图表 ----------------
const riskChart = ref<HTMLElement>()
const scheduleChart = ref<HTMLElement>()
let riskChartInstance: echarts.ECharts | null = null
let scheduleChartInstance: echarts.ECharts | null = null

const RISK_COLORS: Record<string, string> = {
  overdue: '#ef4444',
  soon: '#f59e0b',
  upcoming: '#3b82f6',
  normal: '#94a3b8'
}

const renderRiskChart = () => {
  if (!riskChart.value) return
  if (!riskChartInstance) riskChartInstance = echarts.init(riskChart.value)
  const dist = store.riskDistribution
  riskChartInstance.setOption(
    {
      title: dist.every(r => r.count === 0)
        ? {
            text: '暂无待执行计划',
            left: 'center',
            top: 'center',
            textStyle: { color: '#94a3b8', fontSize: 14, fontWeight: 'normal' }
          }
        : undefined,
      tooltip: { trigger: 'item', formatter: '{b}: {c} 项 ({d}%)' },
      legend: { bottom: 0 },
      series: [
        {
          name: '逾期风险',
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{c} 项' },
          data: dist.map(r => ({
            name: RISK_META[r.key].label,
            value: r.count,
            itemStyle: { color: RISK_COLORS[r.key] }
          }))
        }
      ]
    },
    { notMerge: true }
  )
}

const renderScheduleChart = () => {
  if (!scheduleChart.value) return
  if (!scheduleChartInstance) scheduleChartInstance = echarts.init(scheduleChart.value)
  const data = store.upcomingSchedule
  scheduleChartInstance.setOption(
    {
      title: !data.length
        ? {
            text: '未来30天暂无保养安排',
            left: 'center',
            top: 'center',
            textStyle: { color: '#94a3b8', fontSize: 14, fontWeight: 'normal' }
          }
        : undefined,
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 30, bottom: data.length > 8 ? 60 : 30 },
      xAxis: {
        type: 'category',
        data: data.map(d => d.date),
        axisLabel: { rotate: data.length > 8 ? 35 : 0 }
      },
      yAxis: { type: 'value', minInterval: 1, name: '计划数' },
      series: [
        {
          name: '保养计划',
          type: 'bar',
          barMaxWidth: 36,
          itemStyle: {
            color: (params: any) => (params.name === '已逾期' ? '#ef4444' : '#3b82f6'),
            borderRadius: [4, 4, 0, 0]
          },
          label: { show: true, position: 'top' },
          data: data.map(d => d.count)
        }
      ]
    },
    { notMerge: true }
  )
}

const renderAll = () => {
  nextTick(() => {
    renderRiskChart()
    renderScheduleChart()
  })
}

// 完成维护/计划变更后图表与卡片自动同步
watch(
  () => [store.plans.map(p => `${p.id}-${p.status}-${p.plannedDate}`).join('|')],
  renderAll
)

const resize = () => {
  riskChartInstance?.resize()
  scheduleChartInstance?.resize()
}

onMounted(() => {
  renderAll()
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  riskChartInstance?.dispose()
  scheduleChartInstance?.dispose()
})
</script>

<style scoped lang="scss">
.overview-container {
  width: 100%;
}

.h-full {
  height: 100%;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.12);
  }

  .stat-icon {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    color: #fff;

    &.primary {
      background: #3b82f6;
    }
    &.running {
      background: #f59e0b;
    }
    &.danger {
      background: #ef4444;
    }
    &.success {
      background: #22c55e;
    }
  }

  .stat-value {
    font-size: 30px;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 13px;
    color: #64748b;
    margin-top: 4px;
  }

  &.running .stat-value {
    color: #f59e0b;
  }
  &.danger .stat-value {
    color: #ef4444;
  }
  &.success .stat-value {
    color: #22c55e;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.chart-medium {
  width: 100%;
  height: 300px;
}

.ml-10 {
  margin-left: 10px;
}

.mb-20 {
  margin-bottom: 20px;
}

.record-line {
  display: flex;
  align-items: center;
  gap: 8px;

  .name {
    font-weight: 600;
  }
}

.record-sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}
</style>
