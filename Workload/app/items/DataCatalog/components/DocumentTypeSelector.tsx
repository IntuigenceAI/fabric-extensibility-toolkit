import React from "react";
import {
    Dropdown,
    Option,
    makeStyles,
} from "@fluentui/react-components";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentTypeSelectorProps {
    value: string;
    onChange: (value: string) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const DOCUMENT_TYPE_OPTIONS: { label: string; value: string }[] = [
    { label: "Document", value: "document" },
    { label: "P&ID", value: "pnid" },
    { label: "PFD", value: "pfd" },
    { label: "Datasheet", value: "datasheet" },
    { label: "Timeseries", value: "timeseries" },
    { label: "Device Config", value: "device_config" },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        rowGap: "4px",
    },
    dropdown: {
        minWidth: "140px",
    },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentTypeSelector({ value, onChange }: DocumentTypeSelectorProps) {
    const styles = useStyles();

    const selectedOption = DOCUMENT_TYPE_OPTIONS.find(opt => opt.value === value);
    const selectedLabel = selectedOption?.label ?? "Document";

    return (
        <div className={styles.root}>
            <Dropdown
                className={styles.dropdown}
                value={selectedLabel}
                selectedOptions={[value]}
                onOptionSelect={(_, data) => {
                    if (data.optionValue) {
                        onChange(data.optionValue);
                    }
                }}
                size="small"
                placeholder="Select type"
            >
                {DOCUMENT_TYPE_OPTIONS.map(opt => (
                    <Option key={opt.value} value={opt.value}>
                        {opt.label}
                    </Option>
                ))}
            </Dropdown>
        </div>
    );
}
