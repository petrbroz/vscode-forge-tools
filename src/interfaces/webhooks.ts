export interface WebhookSystem {
    id: string;
    name: string;
    events: WebhookEvent[];
}

export interface WebhookEvent {
    id: string;
    description: string;
    scopes: string[];
}

export const WEBHOOKS: WebhookSystem[] = [
    {
        id: 'data',
        name: 'Data Management',
        events: [
            {
                id: 'dm.version.added',
                description: 'When a new version of an item (file) is added to a folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.version.modified',
                description: 'When a version of an item is modified.',
                scopes: ['folder']
            },
            {
                id: 'dm.version.deleted',
                description: 'When a version of an item is deleted from a folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.version.moved',
                description: 'When a version of an item is moved into this folder from another folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.version.moved.out',
                description: 'When a version of an item is moved out of this folder into another folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.version.copied',
                description: 'When a version of an item is copied to a folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.version.copied.out',
                description: 'When a version of an item is copied out of this folder into another folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.lineage.reserved',
                description: 'When a item and its versions are reserved so only one user can modify it.',
                scopes: ['folder']
            },
            {
                id: 'dm.lineage.unreserved',
                description: 'When a reservation on an item and its versions is removed so anyone with appropriate permissions can modify it.',
                scopes: ['folder']
            },
            {
                id: 'dm.lineage.updated',
                description: 'When a item is updated.',
                scopes: ['folder']
            },
            {
                id: 'dm.folder.added',
                description: 'When a new folder is added to a folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.folder.modified',
                description: 'When a folder is modified.',
                scopes: ['folder']
            },
            {
                id: 'dm.folder.deleted',
                description: 'When a folder is deleted.',
                scopes: ['folder']
            },
            {
                id: 'dm.folder.purged',
                description: 'When a folder is purged.',
                scopes: ['folder']
            },
            {
                id: 'dm.folder.moved',
                description: 'When a folder is moved to another folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.folder.moved.out',
                description: 'When a folder is moved out of this folder into another folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.folder.copied',
                description: 'When a folder is copied to another folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.folder.copied.out',
                description: 'When a folder is copied out of this folder into another folder.',
                scopes: ['folder']
            },
            {
                id: 'dm.operation.started',
                description: 'When an async operation starts',
                scopes: ['folder']
            },
            {
                id: 'dm.operation.completed',
                description: 'When an async operation completes',
                scopes: ['folder']
            }
        ]
    },
    {
        id: 'derivative',
        name: 'Model Derivative',
        events: [
            {
                id: 'extraction.finished',
                description: 'When a job is completed.',
                scopes: ['workflow']
            },
            {
                id: 'extraction.updated',
                description: 'When a job is updated.',
                scopes: ['workflow']
            }
        ]
    },
    {
        id: 'adsk.c4r',
        name: 'Revit Cloud Worksharing',
        events: [
            {
                id: 'model.sync',
                description: 'When a model is Synchronized with Central.',
                scopes: ['folder']
            },
            {
                id: 'model.publish',
                description: 'When a Revit Cloud Worksharing model is queued or when processing starts.',
                scopes: ['folder']
            }
        ]
    },
    {
        id: 'adsk.flc.production',
        name: 'Fusion Lifecycle',
        events: [
            {
                id: 'item.clone',
                description: 'When a Fusion Lifecycle item is cloned.',
                scopes: ['workspace']
            },
            {
                id: 'item.create',
                description: 'When a Fusion Lifecycle item is created.',
                scopes: ['workspace']
            },
            {
                id: 'item.lock',
                description: 'When a Fusion Lifecycle item transitions into a locked state.',
                scopes: ['workspace']
            },
            {
                id: 'item.release',
                description: 'When a Fusion Lifecycle item is released.',
                scopes: ['workspace']
            },
            {
                id: 'item.unlock',
                description: 'When an FLC item transitions from locked state to an unlocked state.',
                scopes: ['workspace']
            },
            {
                id: 'item.update',
                description: 'When the item details of a Fusion Lifecycle item are updated.',
                scopes: ['workspace']
            },
            {
                id: 'workflow.transition',
                description: 'When a specific transition is performed on a Fusion Lifecycle item.',
                scopes: ['workflow.transition']
            }
        ]
    },
    {
        id: 'autodesk.construction.cost',
        name: 'ACC Cost Management',
        events: [
            {
                id: 'budget.created-1.0',
                description: 'When a budget is created.',
                scopes: ['project']
            },
            {
                id: 'budget.updated-1.0',
                description: 'When a budget is updated. This event is sent only when the corresponding code, quantity, or unitPrice changes.',
                scopes: ['project']
            },
            {
                id: 'budget.deleted-1.0',
                description: 'When a budget is deleted.',
                scopes: ['project']
            },
            {
                id: 'budgetPayment.created-1.0',
                description: 'When a budget payment is created.',
                scopes: ['project']
            },
            {
                id: 'budgetPayment.updated-1.0',
                description: 'When a budget payment is updated. This event is sent only when the corresponding status changes.',
                scopes: ['project']
            },
            {
                id: 'budgetPayment.deleted-1.0',
                description: 'When a budget payment is deleted.',
                scopes: ['project']
            },
            {
                id: 'contract.created-1.0',
                description: 'When a contract is created.',
                scopes: ['project']
            },
            {
                id: 'contract.updated-1.0',
                description: 'When a contract is updated. This event is sent only when the corresponding status or locked changes.',
                scopes: ['project']
            },
            {
                id: 'contract.deleted-1.0',
                description: 'When a contract is deleted.',
                scopes: ['project']
            },
            {
                id: 'cor.created-1.0',
                description: 'When a change order request is created.',
                scopes: ['project']
            },
            {
                id: 'cor.updated-1.0',
                description: 'When a change order request is updated. This event is sent only when the corresponding status changes (including costStatus and budgetStatus).',
                scopes: ['project']
            },
            {
                id: 'cor.deleted-1.0',
                description: 'When a change order request is deleted.',
                scopes: ['project']
            },
            {
                id: 'costPayment.created-1.0',
                description: 'When a cost payment is created.',
                scopes: ['project']
            },
            {
                id: 'costPayment.updated-1.0',
                description: 'When a cost payment is updated. This event is sent only when the corresponding status changes.',
                scopes: ['project']
            },
            {
                id: 'costPayment.deleted-1.0',
                description: 'When a cost payment is deleted.',
                scopes: ['project']
            },
            {
                id: 'expense.created-1.0',
                description: 'When an expense is created.',
                scopes: ['project']
            },
            {
                id: 'expense.updated-1.0',
                description: 'When an expense is updated. This event is sent only when the corresponding status changes.',
                scopes: ['project']
            },
            {
                id: 'expense.deleted-1.0',
                description: 'When an expense is deleted.',
                scopes: ['project']
            },
            {
                id: 'expenseItem.created-1.0',
                description: 'When an expense item is created.',
                scopes: ['project']
            },
            {
                id: 'expenseItem.updated-1.0',
                description: 'When an expense item is updated. This event is sent only when the corresponding budgetId changes.',
                scopes: ['project']
            },
            {
                id: 'expenseItem.deleted-1.0',
                description: 'When an expense item is deleted.',
                scopes: ['project']
            },
            {
                id: 'mainContract.created-1.0',
                description: 'When a main contract is created.',
                scopes: ['project']
            },
            {
                id: 'mainContract.updated-1.0',
                description: 'When a main contract is updated. This event is sent only when the corresponding status or locked value changes.',
                scopes: ['project']
            },
            {
                id: 'mainContract.deleted-1.0',
                description: 'When a main contract is deleted.',
                scopes: ['project']
            },
            {
                id: 'mainContractItem.created-1.0',
                description: 'When a main contract item is created.',
                scopes: ['project']
            },
            {
                id: 'mainContractItem.updated-1.0',
                description: 'When a main contract item is updated. This event is sent only when the corresponding amount, quantity, unitPrice, or budgetId changes.',
                scopes: ['project']
            },
            {
                id: 'mainContractItem.deleted-1.0',
                description: 'When a main contract item is deleted.',
                scopes: ['project']
            },
            {
                id: 'oco.created-1.0',
                description: 'When an owner change order is created.',
                scopes: ['project']
            },
            {
                id: 'oco.updated-1.0',
                description: 'When an owner change order is updated. This event is sent only when the corresponding status changes (including costStatus and budgetStatus).',
                scopes: ['project']
            },
            {
                id: 'oco.deleted-1.0',
                description: 'When an owner change order is deleted.',
                scopes: ['project']
            },
            {
                id: 'pco.created-1.0',
                description: 'When a potential change order is created.',
                scopes: ['project']
            },
            {
                id: 'pco.updated-1.0',
                description: 'When a potential change order is updated. This event is sent only when the corresponding status changes (including costStatus and budgetStatus).',
                scopes: ['project']
            },
            {
                id: 'pco.deleted-1.0',
                description: 'When a potential change order is deleted.',
                scopes: ['project']
            },
            {
                id: 'project.initialized-1.0',
                description: 'When a cost project has been initialized.',
                scopes: ['account']
            },
            {
                id: 'rfq.created-1.0',
                description: 'When a request for quote is created.',
                scopes: ['project']
            },
            {
                id: 'rfq.updated-1.0',
                description: 'When a request for quote is updated. This event is sent only when the corresponding status changes (including costStatus and budgetStatus).',
                scopes: ['project']
            },
            {
                id: 'rfq.deleted-1.0',
                description: 'When a request for quote is deleted.',
                scopes: ['project']
            },
            {
                id: 'scheduleOfValue.created-1.0',
                description: 'When a schedule of values is created.',
                scopes: ['project']
            },
            {
                id: 'scheduleOfValue.updated-1.0',
                description: 'When a schedule of values is updated. This event is sent only when the corresponding amount, quantity, unitPrice, or allocatedAmount changes.',
                scopes: ['project']
            },
            {
                id: 'scheduleOfValue.deleted-1.0',
                description: 'When a schedule of values is deleted.',
                scopes: ['project']
            },
            {
                id: 'sco.created-1.0',
                description: 'When a subcontractor change order is created.',
                scopes: ['project']
            },
            {
                id: 'sco.updated-1.0',
                description: 'When a subcontractor change order is updated. This event is sent only when the corresponding status changes (including costStatus and budgetStatus).',
                scopes: ['project']
            },
            {
                id: 'sco.deleted-1.0',
                description: 'When a subcontractor change order is deleted.',
                scopes: ['project']
            }
        ]
    },
    {
        id: 'autodesk.construction.bc',
        name: 'BuildingConnected',
        events: [
            {
                id: 'bid.created-1.0',
                description: 'When a new bid revision is created.',
                scopes: ['companyId']
            },
            {
                id: 'opportunity.comment.created-1.0',
                description: 'When a new opportunity comment is created.',
                scopes: ['companyId']
            },
            {
                id: 'opportunity.comment.deleted-1.0',
                description: 'When an opportunity comment is deleted.',
                scopes: ['companyId']
            },
            {
                id: 'opportunity.comment.updated-1.0',
                description: 'When an opportunity comment is updated.',
                scopes: ['companyId']
            },
            {
                id: 'opportunity.created-1.0',
                description: 'When a new opportunity is created.',
                scopes: ['companyId']
            },
            {
                id: 'opportunity.status.updated-1.0',
                description: 'When an opportunity status is updated.',
                scopes: ['companyId']
            }
        ]
    },
    {
        id: 'autodesk.construction.issues',
        name: 'ACC Issues',
        events: [
            {
                id: 'issue.created-1.0',
                description: 'When an issue is created.',
                scopes: ['project']
            },
            {
                id: 'issue.updated-1.0',
                description: 'When an issue is updated.',
                scopes: ['project']
            },
            {
                id: 'issue.deleted-1.0',
                description: 'When an issue is deleted.',
                scopes: ['project']
            },
            {
                id: 'issue.restored-1.0',
                description: 'When an issue is restored.',
                scopes: ['project']
            },
            {
                id: 'issue.unlinked-1.0',
                description: 'When an issue is unlinked from a placement.',
                scopes: ['project']
            }
        ]
    }
];
