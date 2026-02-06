-- Habilitar extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Operaciones (Uploads)
CREATE TABLE operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL,
    correlation_id UUID NOT NULL,
    endpoint VARCHAR(50),
    status VARCHAR(20) CHECK (status IN ('RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    rows_inserted INT DEFAULT 0,
    rows_rejected INT DEFAULT 0,
    duration_ms INT,
    error_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Pólizas (Policies)
CREATE TABLE policies (
    policy_number VARCHAR(50) PRIMARY KEY,
    customer VARCHAR(100),
    policy_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    premium_usd NUMERIC(10, 2),
    status VARCHAR(20),
    insured_value_usd NUMERIC(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
