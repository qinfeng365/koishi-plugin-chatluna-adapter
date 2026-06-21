import { Context, icons } from '@koishijs/client'
import type {} from 'koishi-plugin-chatluna-model-hub-adapter'
import ActivityModelHub from './assets/activity-model-hub.vue'
import dashboard from './dashboard.vue'

export default (ctx: Context) => {
    icons.register('activity:model-hub', ActivityModelHub)

    ctx.page({
        name: 'Model Hub',
        path: '/chatluna-model-hub',
        icon: 'activity:model-hub',
        fields: ['chatluna_model_hub'],
        authority: 1,
        component: dashboard
    })
}
