<template>
  <div class="equipment-container">
    <el-row :gutter="20" class="mb-20">
      <el-col :span="6">
        <div class="stat-card" @click="filterByStatus('')">
          <div class="stat-value">{{ store.equipmentStats.total }}</div>
          <div class="stat-label">设备总数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card running" @click="filterByStatus('运行中')">
          <div class="stat-value">{{ store.equipmentStats.running }}</div>
          <div class="stat-label">运行中</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card maintenance" @click="filterByStatus('待维护')">
          <div class="stat-value">{{ store.equipmentStats.maintenance }}</div>
          <div class="stat-label">待维护</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card fault" @click="filterByStatus('故障')">
          <div class="stat-value">{{ store.equipmentStats.fault }}</div>
          <div class="stat-label">故障</div>
        </div>
      </el-col>
    </el-row>

    <el-card class="mb-20">
      <template #header>
        <div class="card-header">
          <span>设备列表</span>
          <div>
            <el-button type="primary" size="small">新增设备</el-button>
            <el-button size="small">批量导入</el-button>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="filterForm" class="filter-form mb-20">
        <el-form-item label="设备名称">
          <el-input v-model="filterForm.equipmentName" placeholder="请输入设备名称" clearable />
        </el-form-item>
        <el-form-item label="设备类型">
          <el-select v-model="filterForm.equipmentType" placeholder="请选择设备类型" clearable>
            <el-option label="全部" value="" />
            <el-option label="抽油机" value="抽油机" />
            <el-option label="阀门" value="阀门" />
            <el-option label="传感器" value="传感器" />
            <el-option label="电机" value="电机" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="请选择状态" clearable>
            <el-option label="全部" value="" />
            <el-option label="运行中" value="运行中" />
            <el-option label="待维护" value="待维护" />
            <el-option label="故障" value="故障" />
            <el-option label="停机" value="停机" />
          </el-select>
        </el-form-item>
        <el-form-item label="维护日期范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="filteredEquipmentList" border stripe style="width: 100%">
        <el-table-column prop="equipmentCode" label="设备编码" width="120" />
        <el-table-column prop="equipmentName" label="设备名称" width="150" />
        <el-table-column prop="equipmentType" label="设备类型" width="120" />
        <el-table-column prop="model" label="型号规格" width="150" />
        <el-table-column prop="installLocation" label="安装位置" width="150" />
        <el-table-column prop="wellName" label="所属井" width="100" />
        <el-table-column prop="runningHours" label="运行时长(h)" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastMaintenanceDate" label="上次维护日期" width="130" />
        <el-table-column prop="nextMaintenanceDate" label="下次维护日期" width="150">
          <template #default="{ row }">
            <span :class="{ 'text-danger': isOverdue(row.nextMaintenanceDate) }">
              {{ row.nextMaintenanceDate }}
              <el-tag v-if="isOverdue(row.nextMaintenanceDate)" type="danger" size="small" class="ml-5">逾期</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="viewMaintenanceRecords(row)">维护记录</el-button>
            <el-button type="success" size="small" link @click="openMaintenanceDialog(row)">维护登记</el-button>
            <el-button type="danger" size="small" link>删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无设备数据" />
        </template>
      </el-table>
    </el-card>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>设备类型分布</span>
          </template>
          <div ref="typeChart" class="chart-medium"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>待维护设备提醒</span>
              <el-badge :value="overdueCount" class="item" type="danger" :hidden="overdueCount === 0" />
            </div>
          </template>
          <el-timeline v-if="store.reminders.length">
            <el-timeline-item
              v-for="item in store.reminders"
              :key="item.id"
              :timestamp="item.plannedDate"
              :type="RISK_META[item.risk].timelineType"
              class="timeline-item"
            >
              <div class="timeline-content">
                <span class="equipment-name">{{ item.equipmentName }}</span>
                <el-tag size="small" :type="RISK_META[item.risk].tagType" class="mr-10">{{ RISK_META[item.risk].label }}</el-tag>
                <span class="content">{{ item.maintenanceType }} · 负责人 {{ item.assignee }}</span>
                <el-button type="primary" size="small" link @click="openCompleteFromPlan(item)">立即维护</el-button>
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无待执行的保养计划" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      v-model="recordDialogVisible"
      title="维护记录"
      width="800px"
    >
      <div class="record-info">
        <span class="label">设备名称：</span>
        <span class="value">{{ currentEquipment?.equipmentName }}</span>
        <span class="label ml-20">设备编码：</span>
        <span class="value">{{ currentEquipment?.equipmentCode }}</span>
      </div>
      <el-table :data="currentRecords" border stripe style="width: 100%; margin-top: 15px;">
        <el-table-column prop="maintenanceDate" label="维护日期" width="120" />
        <el-table-column prop="maintenanceType" label="维护类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getMaintenanceTypeColor(row.maintenanceType)" size="small">{{ row.maintenanceType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="maintenancePerson" label="维护人员" width="100" />
        <el-table-column prop="maintenanceContent" label="维护内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="maintenanceResult" label="维护结果" width="100">
          <template #default="{ row }">
            <el-tag :type="getResultColor(row.maintenanceResult)" size="small">{{ row.maintenanceResult }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="cost" label="费用(元)" width="100">
          <template #default="{ row }">
            {{ row.cost || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <template #empty>
          <el-empty description="该设备暂无维护记录" :image-size="80" />
        </template>
      </el-table>
      <template #footer>
        <el-button @click="recordDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <MaintenanceDialog v-model="dialogVisible" :equipment-id="dialogEquipmentId" :plan="dialogPlan" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useMaintenanceStore, RISK_META } from '@/store/modules/maintenance'
import type { MaintenancePlan } from '@/api/equipment'
import MaintenanceDialog from '@/components/MaintenanceDialog.vue'

const store = useMaintenanceStore()

const typeChart = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null
const recordDialogVisible = ref(false)

const currentEquipment = ref<any>(null)
const currentRecords = computed(() =>
  currentEquipment.value ? store.getRecords(currentEquipment.value.id) : []
)

const filterForm = reactive({
  equipmentName: '',
  equipmentType: '',
  status: '',
  dateRange: [] as string[]
})

const overdueCount = computed(() => store.planStats.overdue)

const filteredEquipmentList = computed(() => {
  let result = [...store.equipmentList]

  if (filterForm.equipmentName) {
    result = result.filter(item => item.equipmentName.includes(filterForm.equipmentName))
  }
  if (filterForm.equipmentType) {
    result = result.filter(item => item.equipmentType === filterForm.equipmentType)
  }
  if (filterForm.status) {
    result = result.filter(item => item.status === filterForm.status)
  }
  if (filterForm.dateRange && filterForm.dateRange.length === 2) {
    const [start, end] = filterForm.dateRange
    result = result.filter(item => {
      const nextDate = new Date(item.nextMaintenanceDate)
      return nextDate >= new Date(start) && nextDate <= new Date(end)
    })
  }
  return result
})

const getStatusType = (status: string) => {
  const map: Record<string, any> = {
    '运行中': 'success',
    '待维护': 'warning',
    '故障': 'danger',
    '停机': 'info'
  }
  return map[status] || 'info'
}

const getMaintenanceTypeColor = (type: string) => {
  const map: Record<string, any> = {
    '常规维护': 'info',
    '故障维修': 'danger',
    '定期保养': 'success',
    '紧急维修': 'warning'
  }
  return map[type] || 'info'
}

const getResultColor = (result: string) => {
  const map: Record<string, any> = {
    '完成': 'success',
    '进行中': 'warning',
    '待跟进': 'danger'
  }
  return map[result] || 'info'
}

const isOverdue = (date: string) => new Date(date) < new Date()

const resetFilter = () => {
  filterForm.equipmentName = ''
  filterForm.equipmentType = ''
  filterForm.status = ''
  filterForm.dateRange = []
}

const filterByStatus = (status: string) => {
  filterForm.status = status
}

// ---------------- 维护登记弹窗（列表行 / 时间线立即维护 共用） ----------------
const dialogVisible = ref(false)
const dialogEquipmentId = ref<number | null>(null)
const dialogPlan = ref<MaintenancePlan | null>(null)

const openMaintenanceDialog = (row: any) => {
  dialogPlan.value = null
  dialogEquipmentId.value = row.id
  dialogVisible.value = true
}

const openCompleteFromPlan = (plan: MaintenancePlan) => {
  dialogPlan.value = plan
  dialogEquipmentId.value = plan.equipmentId
  dialogVisible.value = true
}

const viewMaintenanceRecords = (row: any) => {
  currentEquipment.value = row
  recordDialogVisible.value = true
}

// ---------------- 类型分布图表（数据来自 store，完成维护后同步刷新） ----------------
const renderChart = () => {
  if (!typeChart.value) return
  if (!chartInstance) chartInstance = echarts.init(typeChart.value)
  chartInstance.setOption(
    {
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [
        {
          name: '设备类型',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
          labelLine: { show: false },
          data: store.equipmentTypeDistribution
        }
      ]
    },
    { notMerge: true }
  )
}

watch(
  () => store.equipmentList.map(e => e.equipmentType).join(','),
  () => nextTick(renderChart)
)

onMounted(() => {
  nextTick(renderChart)
  window.addEventListener('resize', resizeChart)
})

const resizeChart = () => chartInstance?.resize()
</script>

<style scoped lang="scss">
.equipment-container {
  width: 100%;
}

.stat-card {
  padding: 25px;
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

  &.running {
    .stat-value {
      color: #22c55e;
    }
  }

  &.maintenance {
    .stat-value {
      color: #f59e0b;
    }
  }

  &.fault {
    .stat-value {
      color: #ef4444;
    }
  }

  .stat-value {
    font-size: 36px;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 8px;
  }

  .stat-label {
    font-size: 14px;
    color: #64748b;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.filter-form {
  padding: 10px;
  background: #f8fafc;
  border-radius: 8px;

  :deep(.el-form-item) {
    margin-bottom: 0;
  }
}

.chart-medium {
  width: 100%;
  height: 300px;
}

.text-danger {
  color: #ef4444;
}

.mr-10 {
  margin-right: 10px;
}

.ml-5 {
  margin-left: 5px;
}

.ml-20 {
  margin-left: 20px;
}

.mb-20 {
  margin-bottom: 20px;
}

.timeline-item {
  cursor: default;
}

.timeline-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 5px 0;
  border-radius: 4px;

  .equipment-name {
    font-weight: 600;
  }

  .content {
    color: #64748b;
  }
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

.item {
  margin-left: 10px;
}
</style>
