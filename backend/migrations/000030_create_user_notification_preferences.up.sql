CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify_payment_overdue BOOLEAN NOT NULL DEFAULT true,
    notify_lease_expiring BOOLEAN NOT NULL DEFAULT true,
    notify_lease_expiring_days INTEGER NOT NULL DEFAULT 30,
    notify_new_message BOOLEAN NOT NULL DEFAULT true,
    notify_maintenance_request BOOLEAN NOT NULL DEFAULT true,
    notify_payment_received BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
