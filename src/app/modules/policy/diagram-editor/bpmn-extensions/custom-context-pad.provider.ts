const FORK_JOIN_ATTR = 'custom:forkJoinType';

function getForkJoinType(bo: any): string | undefined {
  if (!bo) return undefined;
  if (typeof bo.get === 'function') {
    return bo.get(FORK_JOIN_ATTR) || undefined;
  }
  return bo.$attrs?.[FORK_JOIN_ATTR] || undefined;
}

export default function CustomContextPadProvider(
  this: any,
  contextPad: any,
  modeling: any,
  elementFactory: any,
  translate: any,
  bpmnReplace: any
) {
  contextPad.registerProvider(this);

  this.getContextPadEntries = function (element: any) {
    const entries: Record<string, any> = {};
    const bo = element.businessObject;
    if (!bo) return entries;

    const currentType = bo.$type;
    const currentFJT = getForkJoinType(bo);

    // For tasks and exclusive gateways: offer conversion to Fork or Join
    if (currentType === 'bpmn:UserTask' || currentType === 'bpmn:ExclusiveGateway') {
      entries['convert-to-fork'] = {
        group: 'edit',
        className: 'bpmn-icon-gateway-parallel',
        title: translate('Convertir a Fork'),
        action: {
          click: function (_event: any, el: any) {
            const replaced = bpmnReplace.replaceElement(el, {
              type: 'bpmn:ParallelGateway'
            });
            modeling.updateProperties(replaced, { [FORK_JOIN_ATTR]: 'FORK' });
          }
        }
      };

      entries['convert-to-join'] = {
        group: 'edit',
        className: 'bpmn-icon-gateway-parallel',
        title: translate('Convertir a Join'),
        action: {
          click: function (_event: any, el: any) {
            const replaced = bpmnReplace.replaceElement(el, {
              type: 'bpmn:ParallelGateway'
            });
            modeling.updateProperties(replaced, { [FORK_JOIN_ATTR]: 'JOIN' });
          }
        }
      };
    }

    // For existing ParallelGateways: toggle between Fork and Join
    if (currentType === 'bpmn:ParallelGateway') {
      if (currentFJT !== 'FORK') {
        entries['set-as-fork'] = {
          group: 'edit',
          className: 'bpmn-icon-gateway-parallel',
          title: translate('Cambiar a Fork'),
          action: {
            click: function () {
              modeling.updateProperties(element, { [FORK_JOIN_ATTR]: 'FORK' });
            }
          }
        };
      }

      if (currentFJT !== 'JOIN') {
        entries['set-as-join'] = {
          group: 'edit',
          className: 'bpmn-icon-gateway-parallel',
          title: translate('Cambiar a Join'),
          action: {
            click: function () {
              modeling.updateProperties(element, { [FORK_JOIN_ATTR]: 'JOIN' });
            }
          }
        };
      }
    }

    return entries;
  };
}

(CustomContextPadProvider as any).$inject = [
  'contextPad',
  'modeling',
  'elementFactory',
  'translate',
  'bpmnReplace'
];
