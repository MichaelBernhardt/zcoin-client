import types from '../../../store/types'
import mixin from './mixin'

export default {
    ...mixin,
    ...({
        namespace: 'PaymentRequest',

        mutations: {
            [types.paymentrequest.CREATE_PAYMENT_REQUEST]: 'createPaymentRequest'
        },

        collection: 'payment-request',

        createPaymentRequest ({ label, message, amount }) {
            console.log('CREATING PAYMENT REQUEST')

            this.send('create', {
                label,
                amount,
                message
            }, types.paymentrequest.ADD_PAYMENT_REQUEST)
        }
    })
}