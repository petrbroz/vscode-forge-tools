import * as assert from 'assert';
import { createServices } from '../../services';
import { OssService } from '../../services/oss';
import { WebhooksService } from '../../services/webhooks';
import { HubsService } from '../../services/hubs';
import { ModelDerivativeService } from '../../services/model-derivative';
import { DesignAutomationService } from '../../services/design-automation';
import { SecureServiceAccountsService } from '../../services/secure-service-accounts';
import { AuthenticationService } from '../../services/authentication';

const FAKE_ENV = {
	title: 'Test Environment',
	clientId: 'fake-client-id',
	clientSecret: 'fake-client-secret'
};

describe('createServices', () => {
	it('wires up every service from a plain environment (2-legged)', () => {
		const services = createServices(FAKE_ENV);
		assert.ok(services.authenticationService instanceof AuthenticationService);
		assert.ok(services.ossService instanceof OssService);
		assert.ok(services.modelDerivativeService instanceof ModelDerivativeService);
		assert.ok(services.designAutomationService instanceof DesignAutomationService);
		assert.ok(services.webhooksService instanceof WebhooksService);
		assert.ok(services.hubsService instanceof HubsService);
		assert.ok(services.secureServiceAccountsService instanceof SecureServiceAccountsService);
	});

	it('wires up every service from a plain environment plus a 3-legged token', () => {
		const services = createServices(FAKE_ENV, 'fake-three-legged-token');
		assert.ok(services.hubsService instanceof HubsService);
		assert.ok(services.modelDerivativeService instanceof ModelDerivativeService);
	});
});
