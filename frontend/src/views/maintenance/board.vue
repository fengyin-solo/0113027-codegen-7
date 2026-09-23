<template>
  <div class="board-container">
    <!-- 概览统计卡片 -->
    <el-row :gutter="20" class="mb-20">
      <el-col :span="6">
        <div class="stat-card" @click="goWorkbench({})">
          <div class="stat-value">{{ store.planStats.total }}</div>
          <div class="stat-label">保养计划总数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card running" @click="goWorkbench({})">
          <div class="stat-value">{{ store.planStats.inProgress + store.planStats.scheduled }}</div>
          <div class="stat-label">进行中/已安排</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card maintenance" @click="goWorkbench({ riskLevel: '逾期' })">
          <div class="stat-value">{{ store.planStats.overdue }}</div>
          <div class="stat-label">计划逾期</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card done" @click="goWorkbench({ status: '已完成' })">
          <div class="stat-value">{{ store.planStats.completed }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mb-20">
      <el-col :span="6">
        <div class="stat-card" @click="goEquipment('')">
          <div class="stat-value">{{ store.equipmentStats.total }}</div>
          <div class="stat-label">设备总数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card running" @click="goEquipment('运行中')">
          <div class="stat-value">{{ store.equipmentStats.running }}</div>
          <div class="stat-label">运行中</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card maintenance" @click="goEquipment('待维护')">
          <div class="stat-value">{{ store.equipmentStats.maintenance }}</div>
          <div class="stat-label">待维护</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card fault" @click="goEquipment('故障')">
          <div class="stat-value">{{ store.equipmentStats.fault }}</div>
          <div class="stat-label">故障</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mb-20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>设备逾期风险分布</span>
              <el-button type="primary" size="small" @click="goWorkbench({})">前往计划工作台</el-button>
            </div>
          </template>
          <div class="risk-grid">
            <div class="risk-item danger" @click="goWorkbench({ riskLevel: '逾期' })">
              <div class="risk-value">{{ store.overdueEquipments.length }}</div>
              <div class="risk-label">逾期</div>
            </div>
            <div class="risk-item warning" @click="goWorkbench({ riskLevel: '临期' })">
              <div class="risk-value">{{ store.dueSoonEquipments.length }}</div>
              <div class="risk-label">7天内临期</div>
            </div>
            <div class="risk-item success" @click="goWorkbench({ riskLevel: '正常' })">
              <div class="risk-value">{{ normalCount }}</div>
              <div class="risk-label">正常</div>
            </div>
            <div class="risk-item info" @click="goWorkbench({})">
              <div class="risk-value">{{ store.planStats.conflict }}</div>
              <div class="risk-label">计划冲突</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span>设备类型分布</span></template>
          <div ref="typeChartRef" class="chart-medium"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mb-20">
      <el-col :span="12">
        <el-card>
          <template #header><span>未来14天保养排期</span></template>
          <div ref="scheduleChartRef" class="chart-medium"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span>负责人任务负载（进行中计划）</span></template>
          <div v-if="store.ownerDistribution.length > 0" ref="ownerChartRef" class="chart-medium"></div>
          <el-empty v-else description="暂无已分配负责人的计划" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>逾期/临期提醒</span>
              <el-badge :value="store.reminderList.length" type="danger" />
            </div>
          </template>
          <el-empty v-if="store.reminderList.length === 0" description="暂无逾期或临期设备" :image-size="60" />
          <el-timeline v-else>
            <el-timeline-item
              v-for="item in store.reminderList"
              :key="item.id"
              :timestamp="item.date"
              :type="item.type"
              class="timeline-item"
              @click="goWorkbench({ keyword: item.equipmentName })"
            >
              <div class="timeline-content">
                <span class="equipment-name">{{ item.equipmentName }}</span>
                <el-tag :type="riskTagType(item.riskLevel)" size="small" class="mr-10">{{ item.riskLevel }}</el-tag>
                <span class="content">{{ item.content }}</span>
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近待执行计划</span>
              <el-button type="primary" size="small" link @click="goWorkbench({})">全部计划</el-button>
            </div>
          </template>
          <el-table :data="upcomingPlans" border stripe size="small" style="width: 100%">
            <el-table-column prop="planDate" label="计划日期" width="110" />
            <el-table-column prop="equipmentName" label="设备" min-width="120" show-overflow-tooltip />
            <el-table-column prop="maintenanceType" label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="maintenanceTypeColor(row.maintenanceType)" size="small">{{ row.maintenanceType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="owner" label="负责人" width="90">
              <template #default="{ row }">{{ row.owner || '未分配' }}</template>
            </el-table-column>
            <el-table-column label="风险" width="80">
              <template #default="{ row }">
                <el-tag :type="riskTagType(row.riskLevel)" size="small">{{ row.riskLevel }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="upcomingPlans.length === 0" description="暂无待执行计划，请前往工作台生成" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { useMaintenanceStore } from '@/store/modules/maintenance'
import type { RiskLevel } from '@/api/equipment'

const router = useRouter()
const store = useMaintenanceStore()
store.load()

const typeChartRef = ref<HTMLElement>()
const scheduleChartRef = ref<HTMLElement>()
const ownerChartRef = ref<HTMLElement>()
let charts: echarts.ECharts[] = []

const normalCount = computed(
  () => store.equipmentWithRisk.filter((e) => e.riskLevel === '正常').length
)

const upcomingPlans = computed(() =>
  [...store.activePlans]
    .sort((a, b) => a.planDate.localeCompare(b.planDate))
    .slice(0, 8)
)

const riskTagType = (level: RiskLevel) =>
  ({ 逾期: 'danger', 临期: 'warning', 正常: 'success' })[level] as 'danger' | 'warning' | 'success'

const maintenanceTypeColor = (type: string) =>
  ({
    常规维护: 'info',
    故障维修: 'danger',
    定期保养: 'success',
    紧急维修: 'warning'
  })[type] || 'info'

const goWorkbench = (query: Record<string, string>) => {
  router.push({ path: '/maintenance/plan', query })
}

const goEquipment = (status: string) => {
  router.push({ path: '/equipment', query: status ? { status } : {} })
}

const TYPE_COLORS: Record<string, string> = {
  抽油机: '#3b82f6',
  阀门: '#22c55e',
  传感器: '#f59e0b',
  电机: '#ef4444',
  其他: '#8b5cf6'
}

const renderCharts = () => {
  charts.forEach((c) => c.dispose())
  charts = []

  if (typeChartRef.value) {
    const chart = echarts.init(typeChartRef.value)
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [
        {
          name: '设备类型',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: store.typeDistribution.map((d) => ({
            ...d,
            itemStyle: { color: TYPE_COLORS[d.name] || '#8b5cf6' }
          }))
        }
      ]
    })
    charts.push(chart)
  }

  if (scheduleChartRef.value) {
    const chart = echarts.init(scheduleChartRef.value)
    const data = store.scheduleByDate
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: data.map((d) => d.label) },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          name: '计划数量',
          type: 'bar',
          barWidth: '55%',
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
          data: data.map((d) => ({
            value: d.count,
            itemStyle: d.count > 0 ? { color: '#3b82f6' } : { color: '#e2e8f0' }
          }))
        }
      ]
    })
    charts.push(chart)
  }

  if (ownerChartRef.value) {
    const chart = echarts.init(ownerChartRef.value)
    const data = store.ownerDistribution
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', data: data.map((d) => d.name) },
      series: [
        {
          name: '任务数',
          type: 'bar',
          barWidth: '55%',
          itemStyle: { color: '#22c55e', borderRadius: [0, 4, 4, 0] },
          data: data.map((d) => d.value)
        }
      ]
    })
    charts.push(chart)
  }
}

const handleResize = () => charts.forEach((c) => c.resize())

onMounted(async () => {
  await nextTick()
  renderCharts()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  charts.forEach((c) => c.dispose())
  charts = []
})

// 从工作台完成计划返回后，图表与统计同步刷新
watch(
  () => [store.planList.length, store.equipmentList.map((e) => e.nextMaintenanceDate).join(',')],
  () => nextTick(renderCharts)
)
</script>

<style scoped lang="scss">
.board-container {
  width: 100%;
}

.stat-card {
  padding: 22px;
  border-radius: 8px;
  background: #fff;
  text-align: center;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.12);
  }

  .stat-value {
    font-size: 32px;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 6px;
  }

  .stat-label {
    font-size: 13px;
    color: #64748b;
  }

  &.running .stat-value {
    color: #22c55e;
  }

  &.maintenance .stat-value {
    color: #f59e0b;
  }

  &.fault .stat-value {
    color: #ef4444;
  }

  &.done .stat-value {
    color: #3b82f6;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.risk-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 10px 0;
}

.risk-item {
  padding: 22px 10px;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  color: #fff;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.85;
  }

  .risk-value {
    font-size: 30px;
    font-weight: 700;
  }

  .risk-label {
    font-size: 13px;
    margin-top: 4px;
    opacity: 0.9;
  }

  &.danger {
    background: linear-gradient(135deg, #ef4444, #f87171);
  }

  &.warning {
    background: linear-gradient(135deg, #f59e0b, #fbbf24);
  }

  &.success {
    background: linear-gradient(135deg, #22c55e, #4ade80);
  }

  &.info {
    background: linear-gradient(135deg, #6366f1, #818cf8);
  }
}

.chart-medium {
  width: 100%;
  height: 280px;
}

.timeline-item {
  cursor: pointer;

  &:hover .timeline-content {
    background: #f8fafc;
  }
}

.timeline-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 5px;
  border-radius: 4px;

  .equipment-name {
    font-weight: 600;
  }

  .content {
    color: #64748b;
    font-size: 13px;
  }
}

.mr-10 {
  margin-right: 10px;
}

.mb-20 {
  margin-bottom: 20px;
}
</style>
