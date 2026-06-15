import { Context } from '@koishijs/client'
import type {} from 'koishi-plugin-chatluna-model-hub-adapter'
import dashboard from './dashboard.vue'

export default (ctx: Context) => {
    ctx.page({
        name: 'Model Hub',
        path: '/chatluna-model-hub',
        fields: ['chatluna_model_hub'],
        authority: 1,
        component: dashboard
    })
}
