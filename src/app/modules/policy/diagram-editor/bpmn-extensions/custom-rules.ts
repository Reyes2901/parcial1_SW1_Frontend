import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';

const FORK_JOIN_ATTR = 'custom:forkJoinType';

function getForkJoinType(element: any): string | undefined {
  const bo = element?.businessObject;
  if (!bo) return undefined;
  if (typeof bo.get === 'function') {
    return bo.get(FORK_JOIN_ATTR) || undefined;
  }
  return bo.$attrs?.[FORK_JOIN_ATTR] || undefined;
}

function isFlowNode(element: any): boolean {
  const type = element?.type;
  if (!type) return false;
  return type.startsWith('bpmn:') && type !== 'bpmn:Lane'
    && type !== 'bpmn:Participant' && type !== 'bpmn:Process';
}

export default class CustomRules extends (RuleProvider as any) {
  constructor(eventBus: any) {
    super(eventBus);
  }

  init() {
    // Allow cross-lane connections: bpmn-js default rules may block
    // connections when source and target are in different lanes.
    // We override at high priority to explicitly allow them.
    this['addRule']('connection.create', 3000, (context: any) => {
      return CustomRules.checkConnection(context.source, context.target);
    });

    this['addRule']('connection.reconnect', 3000, (context: any) => {
      return CustomRules.checkConnection(context.source, context.target);
    });
  }

  private static checkConnection(source: any, target: any): boolean | undefined {
    if (!source || !target) return undefined;

    const sourceFJT = getForkJoinType(source);
    const targetFJT = getForkJoinType(target);

    // JOIN: max 1 outgoing connection
    if (sourceFJT === 'JOIN') {
      const outgoing = source.outgoing?.length || 0;
      if (outgoing >= 1) {
        return false;
      }
    }

    // FORK: max 1 incoming connection
    if (targetFJT === 'FORK') {
      const incoming = target.incoming?.length || 0;
      if (incoming >= 1) {
        return false;
      }
    }

    // Explicitly allow cross-lane/cross-participant connections
    // between any BPMN flow nodes (tasks, gateways, events)
    if (isFlowNode(source) && isFlowNode(target)) {
      if (source.parent !== target.parent) {
        return true;
      }
    }

    return undefined;
  }
}

(CustomRules as any).$inject = ['eventBus'];
