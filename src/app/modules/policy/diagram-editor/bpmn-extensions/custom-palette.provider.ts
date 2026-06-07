const FORK_JOIN_ATTR = 'custom:forkJoinType';

export default function CustomPaletteProvider(
  this: any,
  palette: any,
  create: any,
  elementFactory: any,
  bpmnFactory: any,
  translate: any
) {
  palette.registerProvider(this);

  this.getPaletteEntries = function () {
    function createShapeAction(
      type: string,
      group: string,
      className: string,
      title: string,
      forkJoinType?: string
    ) {
      function createListener(event: any) {
        const boAttrs: Record<string, any> = {};
        if (forkJoinType) {
          boAttrs[FORK_JOIN_ATTR] = forkJoinType;
        }
        const businessObject = bpmnFactory.create(type, boAttrs);
        const shape = elementFactory.createShape({
          type,
          businessObject
        });
        create.start(event, shape);
      }

      return {
        group,
        className,
        title: translate(title),
        action: {
          dragstart: createListener,
          click: createListener
        }
      };
    }

    return {
      'create.user-task': createShapeAction(
        'bpmn:UserTask',
        'activity',
        'bpmn-icon-user-task',
        'Acción (Tarea)'
      ),
      'create.exclusive-gateway': createShapeAction(
        'bpmn:ExclusiveGateway',
        'gateway',
        'bpmn-icon-gateway-xor',
        'Decisión (Gateway Exclusivo)'
      ),
      'create.parallel-gateway-fork': createShapeAction(
        'bpmn:ParallelGateway',
        'gateway',
        'bpmn-icon-gateway-parallel',
        'Fork (Flujo Paralelo)',
        'FORK'
      ),
      'create.parallel-gateway-join': createShapeAction(
        'bpmn:ParallelGateway',
        'gateway',
        'bpmn-icon-gateway-parallel',
        'Join (Sincronización)',
        'JOIN'
      ),
      'create.end-event': createShapeAction(
        'bpmn:EndEvent',
        'event',
        'bpmn-icon-end-event-none',
        'Evento de Fin'
      )
    };
  };
}

(CustomPaletteProvider as any).$inject = [
  'palette',
  'create',
  'elementFactory',
  'bpmnFactory',
  'translate'
];
