<template>
  <el-dialog
    v-model="visible"
    :title="plan ? '完成保养计划 - 维护登记' : '维护登记'"
    width="600px"
    :close-on-click-modal="false"
    @closed="handleClosed"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
      <el-form-item label="设备名称">
        <el-input :model-value="equipmentName" disabled />
      </el-form-item>
      <el-form-item label="设备编码">
        <el-input :model-value="equipmentCode" disabled />
      </el-form-item>
      <el-form-item label="维护类型" prop="maintenanceType">
        <el-select v-model="form.maintenanceType" placeholder="请选择维护类型" style="width: 100%">
          <el-option v-for="t in MAINTENANCE_TYPES" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
      <el-form-item label="维护日期" prop="maintenanceDate">
        <el-date-picker
          v-model="form.maintenanceDate"
          type="date"
          placeholder="选择维护日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="维护人员" prop="maintenancePerson">
        <el-select
          v-model="form.maintenancePerson"
          placeholder="请选择或输入维护人员"
          filterable
          allow-create
          default-first-option
          style="width: 100%"
        >
          <el-option v-for="p in DEFAULT_ASSIGNEES" :key="p" :label="p" :value="p" />
        </el-select>
      </el-form-item>
      <el-form-item label="维护内容" prop="maintenanceContent">
        <el-input
          v-model="form.maintenanceContent"
          type="textarea"
          :rows="4"
          placeholder="请详细描述维护内容"
        />
      </el-form-item>
      <el-form-item label="维护结果" prop="maintenanceResult">
        <el-radio-group v-model="form.maintenanceResult">
          <el-radio label="完成">完成</el-radio>
          <el-radio label="进行中">进行中</el-radio>
          <el-radio label="待跟进">待跟进</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="维护费用" prop="cost">
        <el-input-number v-model="form.cost" :min="0" :precision="2" placeholder="元" />
      </el-form-item>
      <el-form-item label="下次维护日期" prop="nextMaintenanceDate">
        <el-date-picker
          v-model="form.nextMaintenanceDate"
          type="date"
          placeholder="选择下次维护日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
        <div class="form-tip" v-if="form.maintenanceType">
          建议周期：{{ DEFAULT_CYCLE[form.maintenanceType] ? DEFAULT_CYCLE[form.maintenanceType] + ' 天' : '一次性' }}
        </div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          placeholder="请输入备注信息"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">提交</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useMaintenanceStore, MAINTENANCE_TYPES, DEFAULT_ASSIGNEES, DEFAULT_CYCLE, addDays, todayStr } from '@/store/modules/maintenance'
import type { MaintenancePlan } from '@/api/equipment'

const store = useMaintenanceStore()

// 通过 v-model 控制显隐
const visible = defineModel<boolean>('modelValue', { default: false })

const props = defineProps<{
  equipmentId: number | null
  /** 从待执行计划进入完成时传入 */
  plan?: MaintenancePlan | null
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const equipment = computed(() =>
  props.equipmentId ? store.getEquipment(props.equipmentId) : undefined
)
const equipmentName = computed(() => equipment.value?.equipmentName || props.plan?.equipmentName || '')
const equipmentCode = computed(() => equipment.value?.equipmentCode || props.plan?.equipmentCode || '')

interface MaintenanceFormState {
  maintenanceType: string
  maintenanceDate: string
  maintenancePerson: string
  maintenanceContent: string
  maintenanceResult: string
  cost: number
  nextMaintenanceDate: string
  remark: string
}

const buildInitForm = (): MaintenanceFormState => {
  const plan = props.plan
  return {
    maintenanceType: plan?.maintenanceType || '',
    maintenanceDate: todayStr(),
    maintenancePerson: plan?.assignee || '',
    maintenanceContent: plan?.content || '',
    maintenanceResult: '完成',
    cost: 0,
    nextMaintenanceDate: plan
      ? (plan.cycleDays > 0 ? addDays(todayStr(), plan.cycleDays) : addDays(todayStr(), 30))
      : addDays(todayStr(), 30),
    remark: plan?.remark || ''
  }
}

const form = reactive<MaintenanceFormState>(buildInitForm())

const rules: FormRules = {
  maintenanceType: [{ required: true, message: '请选择维护类型', trigger: 'change' }],
  maintenanceDate: [{ required: true, message: '请选择维护日期', trigger: 'change' }],
  maintenancePerson: [{ required: true, message: '请选择维护人员', trigger: 'change' }],
  maintenanceContent: [{ required: true, message: '请输入维护内容', trigger: 'blur' }],
  maintenanceResult: [{ required: true, message: '请选择维护结果', trigger: 'change' }],
  nextMaintenanceDate: [
    {
      validator: (_rule: any, value: string, callback: (err?: Error) => void) => {
        if (value && form.maintenanceDate && value < form.maintenanceDate) {
          callback(new Error('下次维护日期不能早于本次维护日期'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ]
}

// 每次打开弹窗时按传入的设备/计划重置表单
const resetForm = () => {
  Object.assign(form, buildInitForm())
  formRef.value?.clearValidate()
}

// v-model 从 false 变 true 时重置
watch(visible, (val) => {
  if (val) resetForm()
})

const handleClosed = () => {
  formRef.value?.resetFields()
}

const handleSubmit = async () => {
  if (!props.equipmentId) {
    ElMessage.error('提交失败：缺少设备信息')
    return
  }
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (!valid) return
    submitting.value = true
    // 与后端一致的短暂延迟，模拟提交
    setTimeout(() => {
      try {
        store.completeMaintenance({
          equipmentId: props.equipmentId!,
          maintenanceType: form.maintenanceType,
          maintenanceDate: form.maintenanceDate,
          maintenancePerson: form.maintenancePerson,
          maintenanceContent: form.maintenanceContent,
          maintenanceResult: form.maintenanceResult,
          cost: form.cost,
          nextMaintenanceDate: form.nextMaintenanceDate,
          remark: form.remark,
          planId: props.plan?.id
        })
        ElMessage.success('维护登记成功！列表、逾期提醒与统计已同步更新')
        visible.value = false
      } catch (e: any) {
        ElMessage.error(e?.message || '维护登记失败，请稍后重试')
      } finally {
        submitting.value = false
      }
    }, 400)
  })
}
</script>

<style scoped lang="scss">
.form-tip {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.4;
}
</style>
