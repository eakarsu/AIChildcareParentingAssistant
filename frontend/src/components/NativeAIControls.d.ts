import * as React from 'react';
export default function NativeAIControls(props: {children?: React.ReactNode; busy?: boolean; onCancel?: () => void; context?: string; presets?: Array<{name: string; fill: () => {filled: number; manual?: string[]}}> }): React.ReactElement;
