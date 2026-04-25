package payment

type WebhookEvent struct {
	Event    string `json:"event" validate:"required,oneof=PAYMENT_RECEIVED PAYMENT_EXPIRED CHARGE_CREATED CHARGE_VIEWED"`
	ChargeID string `json:"chargeId" validate:"required"`
	PaymentDate *string `json:"paymentDate,omitempty"`
	Value *float64 `json:"value,omitempty"`
}