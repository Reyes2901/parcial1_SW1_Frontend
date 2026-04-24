export class Policy {}

export interface Lane {
  id: string;
  name: string;
  departmentId: string;
  order: number;
  color?: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface FormField {
  name: string;
  type: string; // TEXT, NUMBER, BOOLEAN, DATE, SELECT, IMAGE, SIGNATURE, GEOLOCATION, FILE
  label: string;
  required: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
}

export interface FormSchema {
  title?: string;
  description?: string;
  fields: FormField[];
}

export interface Node {
  id: string;
  type: string; // START, END, ACTIVITY, DECISION, FORK, JOIN
  label: string;
  laneId: string;
  assigneeRole?: string;
  estimatedDurationHours?: number;
  formSchema?: FormSchema;
  position?: Position;
}

export interface Transition {
  id: string;
  sourceId: string;
  targetId: string;
  condition?: string;
  label?: string;
}

export interface ProcessDefinition {
  id?: string;
  name: string;
  description?: string;
  version?: string;
  status?: string;
  createdBy?: string;
  lanes: Lane[];
  nodes: Node[];
  transitions: Transition[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AiGenerateRequest {
  prompt: string;
  language?: string;
  existingLanes?: string[];
}