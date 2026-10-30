<?php
/**
 * Plugin Name:       Sapphire CRM Bridge
 * Description:       Enquiry form for the Contact and Commissions pages. Each enquiry is emailed to you and sent to the Sapphire Woodcrafts CRM as a Lead with a reply task. Add it to a page with [sapphire_enquiry_form] or [sapphire_enquiry_form kind="commission"].
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Sapphire Woodcrafts
 * License:           MIT
 *
 * Why a plugin rather than a form builder: the CRM checks a signature on every
 * enquiry, so the shared secret has to stay on the server. This file signs the
 * enquiry in PHP and the secret never reaches a visitor's browser.
 *
 * Never loses an enquiry:
 *   1. It is always emailed to the notification address.
 *   2. If the CRM cannot be reached, the enquiry is queued and retried hourly.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SW_CRM_OPTION', 'sw_crm_bridge' );
define( 'SW_CRM_QUEUE', 'sw_crm_bridge_queue' );
define( 'SW_CRM_STATUS', 'sw_crm_bridge_status' );

function sw_crm_settings() {
	return wp_parse_args(
		get_option( SW_CRM_OPTION, array() ),
		array(
			'api_url' => '',
			'secret'  => '',
			'notify'  => get_option( 'admin_email' ),
		)
	);
}

/* -------------------------------------------------------------------------
 * Settings > Sapphire CRM
 * ---------------------------------------------------------------------- */

add_action(
	'admin_menu',
	function () {
		add_options_page( 'Sapphire CRM', 'Sapphire CRM', 'manage_options', 'sw-crm-bridge', 'sw_crm_settings_page' );
	}
);

add_action(
	'admin_init',
	function () {
		register_setting( 'sw_crm_bridge', SW_CRM_OPTION, array( 'sanitize_callback' => 'sw_crm_sanitize' ) );
	}
);

function sw_crm_sanitize( $input ) {
	$old    = sw_crm_settings();
	$input  = is_array( $input ) ? $input : array();
	$secret = isset( $input['secret'] ) ? trim( (string) $input['secret'] ) : '';
	$notify = isset( $input['notify'] ) ? sanitize_email( $input['notify'] ) : '';
	return array(
		'api_url' => isset( $input['api_url'] ) ? esc_url_raw( untrailingslashit( trim( $input['api_url'] ) ) ) : '',
		// A blank secret field means "keep the saved one", so the secret never
		// has to be shown on the page to be preserved.
		'secret'  => '' !== $secret ? $secret : $old['secret'],
		'notify'  => $notify ? $notify : get_option( 'admin_email' ),
	);
}

function sw_crm_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$s      = sw_crm_settings();
	$status = get_option( SW_CRM_STATUS, array() );
	$queue  = get_option( SW_CRM_QUEUE, array() );
	$health = null;
	if ( isset( $_GET['sw_test'] ) && check_admin_referer( 'sw_crm_test' ) && $s['api_url'] ) {
		$res    = wp_remote_get( $s['api_url'] . '/health', array( 'timeout' => 60 ) );
		$health = is_wp_error( $res ) ? $res->get_error_message() : wp_remote_retrieve_response_code( $res ) . ' ' . wp_remote_retrieve_body( $res );
	}
	?>
	<div class="wrap">
		<h1>Sapphire CRM</h1>
		<p>Enquiry forms send each enquiry to the CRM and email a copy to the notification address.
			Add a form to any page with <code>[sapphire_enquiry_form]</code>, or <code>[sapphire_enquiry_form kind="commission"]</code> on the Commissions page.</p>
		<form method="post" action="options.php">
			<?php settings_fields( 'sw_crm_bridge' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="sw_api">CRM address</label></th>
					<td><input id="sw_api" class="regular-text" type="url" name="<?php echo esc_attr( SW_CRM_OPTION ); ?>[api_url]" value="<?php echo esc_attr( $s['api_url'] ); ?>" placeholder="https://sapphire-crm-api.onrender.com">
						<p class="description">The backend address, without a trailing slash.</p></td>
				</tr>
				<tr>
					<th scope="row"><label for="sw_secret">Shared secret</label></th>
					<td><input id="sw_secret" class="regular-text" type="password" autocomplete="new-password" name="<?php echo esc_attr( SW_CRM_OPTION ); ?>[secret]" value="" placeholder="<?php echo $s['secret'] ? esc_attr__( 'Saved. Leave blank to keep it.' ) : ''; ?>">
						<p class="description">Must match WEBSITE_ENQUIRY_SECRET on the backend.</p></td>
				</tr>
				<tr>
					<th scope="row"><label for="sw_notify">Email enquiries to</label></th>
					<td><input id="sw_notify" class="regular-text" type="email" name="<?php echo esc_attr( SW_CRM_OPTION ); ?>[notify]" value="<?php echo esc_attr( $s['notify'] ); ?>"></td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
		<h2>Status</h2>
		<p>Last enquiry sent to the CRM: <strong><?php echo esc_html( isset( $status['last_ok'] ) ? $status['last_ok'] : 'none yet' ); ?></strong><br>
			Last problem: <strong><?php echo esc_html( isset( $status['last_error'] ) ? $status['last_error'] : 'none' ); ?></strong><br>
			Waiting to retry: <strong><?php echo (int) count( $queue ); ?></strong></p>
		<p><a class="button" href="<?php echo esc_url( wp_nonce_url( admin_url( 'options-general.php?page=sw-crm-bridge&sw_test=1' ), 'sw_crm_test' ) ); ?>">Test connection</a>
			<?php if ( null !== $health ) : ?>
				&nbsp; Result: <code><?php echo esc_html( $health ); ?></code>
			<?php endif; ?></p>
	</div>
	<?php
}

/* -------------------------------------------------------------------------
 * The form
 * ---------------------------------------------------------------------- */

add_shortcode( 'sapphire_enquiry_form', 'sw_crm_form' );

function sw_crm_form( $atts ) {
	$atts   = shortcode_atts(
		array(
			'kind'   => 'contact',
			'button' => '',
		),
		$atts,
		'sapphire_enquiry_form'
	);
	$kind   = 'commission' === $atts['kind'] ? 'commission' : 'contact';
	$button = $atts['button'] ? $atts['button'] : ( 'commission' === $kind ? 'Send commission enquiry' : 'Send message' );
	$state  = isset( $_GET['enquiry'] ) ? sanitize_key( $_GET['enquiry'] ) : '';
	$back   = remove_query_arg( 'enquiry', ( is_ssl() ? 'https://' : 'http://' ) . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] );
	$label  = 'commission' === $kind ? 'Tell us about the piece you have in mind' : 'Your message';
	$hint   = 'commission' === $kind ? 'Occasion, size, timber, and any date you need it by. You can mention photos and we will ask for them.' : '';

	ob_start();
	sw_crm_form_styles();
	?>
	<div class="sw-enquiry" id="enquiry">
		<?php if ( 'sent' === $state ) : ?>
			<div class="sw-enquiry-notice is-ok" role="status"><strong>Thank you, your message is on its way.</strong> We reply personally, usually within two working days.</div>
		<?php elseif ( 'invalid' === $state ) : ?>
			<div class="sw-enquiry-notice is-error" role="alert">Please add your name, a valid email address and a message, then try again.</div>
		<?php elseif ( 'error' === $state ) : ?>
			<div class="sw-enquiry-notice is-error" role="alert">Sorry, your message could not be sent. Please try again in a moment, or message us on Instagram.</div>
		<?php elseif ( 'busy' === $state ) : ?>
			<div class="sw-enquiry-notice is-error" role="alert">We have received several messages from you just now. Please wait a little before sending another.</div>
		<?php endif; ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>#enquiry" class="sw-enquiry-form">
			<input type="hidden" name="action" value="sw_crm_enquiry">
			<input type="hidden" name="kind" value="<?php echo esc_attr( $kind ); ?>">
			<input type="hidden" name="_back" value="<?php echo esc_url( $back ); ?>">
			<input type="hidden" name="_t" value="<?php echo esc_attr( time() ); ?>">
			<?php wp_nonce_field( 'sw_crm_enquiry', '_swnonce' ); ?>
			<p class="sw-hp" aria-hidden="true"><label>Leave this empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label></p>
			<div class="sw-enquiry-row">
				<p><label for="sw-name">Your name</label><input id="sw-name" name="name" type="text" required maxlength="200" autocomplete="name"></p>
				<p><label for="sw-email">Email</label><input id="sw-email" name="email" type="email" required maxlength="200" autocomplete="email"></p>
			</div>
			<p><label for="sw-phone">Phone <span>(optional)</span></label><input id="sw-phone" name="phone" type="tel" maxlength="40" autocomplete="tel"></p>
			<p><label for="sw-message"><?php echo esc_html( $label ); ?></label>
				<?php if ( $hint ) : ?><small><?php echo esc_html( $hint ); ?></small><?php endif; ?>
				<textarea id="sw-message" name="message" rows="6" required maxlength="5000"></textarea></p>
			<p class="sw-enquiry-legal">We use your details only to reply to this enquiry. See our <a href="<?php echo esc_url( get_privacy_policy_url() ); ?>">privacy policy</a>.</p>
			<p><button type="submit" class="wp-element-button"><?php echo esc_html( $button ); ?></button></p>
		</form>
	</div>
	<?php
	return ob_get_clean();
}

function sw_crm_form_styles() {
	static $done = false;
	if ( $done ) {
		return;
	}
	$done = true;
	?>
	<style>
	.sw-enquiry{max-width:760px}
	.sw-enquiry-form p{margin:0 0 1.25rem}
	.sw-enquiry-row{display:grid;grid-template-columns:1fr 1fr;gap:0 1.25rem}
	.sw-enquiry-form label{display:block;font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;margin-bottom:.5rem;color:var(--wp--preset--color--accent-1,#c9a27a)}
	.sw-enquiry-form label span{letter-spacing:0;text-transform:none;opacity:.7}
	.sw-enquiry-form small{display:block;margin:-.25rem 0 .5rem;font-size:.875rem;color:var(--wp--preset--color--accent-4,#a3968a)}
	.sw-enquiry-form input[type=text],.sw-enquiry-form input[type=email],.sw-enquiry-form input[type=tel],.sw-enquiry-form textarea{width:100%;box-sizing:border-box;padding:.9rem 1rem;font:inherit;border-radius:0;
		background:var(--wp--preset--color--accent-5,#1d1712);color:var(--wp--preset--color--contrast,#ede4d6);border:1px solid rgba(237,228,214,.28)}
	.sw-enquiry-form input:focus,.sw-enquiry-form textarea:focus{outline:1px solid var(--wp--preset--color--accent-1,#c9a27a);outline-offset:1px}
	.sw-enquiry-legal{font-size:.875rem;color:var(--wp--preset--color--accent-4,#a3968a)}
	.sw-hp{position:absolute!important;left:-10000px;width:1px;height:1px;overflow:hidden}
	.sw-enquiry-notice{padding:1rem 1.25rem;margin:0 0 1.5rem;border:1px solid;font-size:.95rem}
	.sw-enquiry-notice.is-ok{border-color:var(--wp--preset--color--accent-1,#c9a27a)}
	.sw-enquiry-notice.is-error{border-color:#d9776a}
	@media (max-width:600px){.sw-enquiry-row{grid-template-columns:1fr}}
	</style>
	<?php
}

/* -------------------------------------------------------------------------
 * Handling a submission
 * ---------------------------------------------------------------------- */

add_action( 'admin_post_nopriv_sw_crm_enquiry', 'sw_crm_handle' );
add_action( 'admin_post_sw_crm_enquiry', 'sw_crm_handle' );

function sw_crm_redirect( $back, $state ) {
	wp_safe_redirect( add_query_arg( 'enquiry', $state, $back ) . '#enquiry' );
	exit;
}

function sw_crm_handle() {
	$back = wp_validate_redirect( esc_url_raw( wp_unslash( isset( $_POST['_back'] ) ? $_POST['_back'] : '' ) ), home_url( '/' ) );

	// Bots: a filled honeypot, or a form submitted in under three seconds.
	// They are told it worked, so they have no reason to try again.
	$too_fast = ( time() - (int) ( isset( $_POST['_t'] ) ? $_POST['_t'] : 0 ) ) < 3;
	if ( ! empty( $_POST['website'] ) || $too_fast ) {
		sw_crm_redirect( $back, 'sent' );
	}
	if ( ! isset( $_POST['_swnonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_swnonce'] ) ), 'sw_crm_enquiry' ) ) {
		sw_crm_redirect( $back, 'error' );
	}

	// At most five enquiries per visitor per hour.
	$ip    = isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : '';
	$key   = 'sw_enq_' . md5( $ip );
	$count = (int) get_transient( $key );
	if ( $count >= 5 ) {
		sw_crm_redirect( $back, 'busy' );
	}
	set_transient( $key, $count + 1, HOUR_IN_SECONDS );

	$enquiry = array(
		'name'    => sanitize_text_field( wp_unslash( isset( $_POST['name'] ) ? $_POST['name'] : '' ) ),
		'email'   => sanitize_email( wp_unslash( isset( $_POST['email'] ) ? $_POST['email'] : '' ) ),
		'phone'   => sanitize_text_field( wp_unslash( isset( $_POST['phone'] ) ? $_POST['phone'] : '' ) ),
		'kind'    => ( isset( $_POST['kind'] ) && 'commission' === $_POST['kind'] ) ? 'commission' : 'contact',
		'message' => sanitize_textarea_field( wp_unslash( isset( $_POST['message'] ) ? $_POST['message'] : '' ) ),
	);
	if ( '' === $enquiry['name'] || ! is_email( $enquiry['email'] ) || '' === trim( $enquiry['message'] ) ) {
		sw_crm_redirect( $back, 'invalid' );
	}
	if ( '' === $enquiry['phone'] ) {
		$enquiry['phone'] = null;
	}

	$mailed = sw_crm_email_copy( $enquiry );
	$sent   = sw_crm_send( $enquiry );
	if ( ! $sent ) {
		$queue   = get_option( SW_CRM_QUEUE, array() );
		$queue[] = $enquiry;
		update_option( SW_CRM_QUEUE, array_slice( $queue, -200 ), false );
	}

	// Success if it reached EITHER the CRM or the inbox; it is not lost.
	sw_crm_redirect( $back, ( $sent || $mailed ) ? 'sent' : 'error' );
}

function sw_crm_email_copy( $e ) {
	$s       = sw_crm_settings();
	$subject = ( 'commission' === $e['kind'] ? 'New commission enquiry' : 'New website enquiry' ) . ' from ' . $e['name'];
	$body    = "Name: {$e['name']}\nEmail: {$e['email']}\nPhone: " . ( $e['phone'] ? $e['phone'] : '-' ) . "\n\n{$e['message']}\n";
	return wp_mail( $s['notify'], $subject, $body, array( 'Reply-To: ' . $e['name'] . ' <' . $e['email'] . '>' ) );
}

function sw_crm_send( $e ) {
	$s = sw_crm_settings();
	if ( ! $s['api_url'] || ! $s['secret'] ) {
		sw_crm_note( 'last_error', 'CRM address or secret not set' );
		return false;
	}
	$payload = wp_json_encode( $e );
	$res     = wp_remote_post(
		$s['api_url'] . '/integrations/website/enquiry',
		array(
			'timeout' => 20,
			'headers' => array(
				'Content-Type'   => 'application/json',
				'X-SW-Signature' => base64_encode( hash_hmac( 'sha256', $payload, $s['secret'], true ) ),
			),
			'body'    => $payload,
		)
	);
	$code = is_wp_error( $res ) ? 0 : (int) wp_remote_retrieve_response_code( $res );
	if ( 201 === $code ) {
		sw_crm_note( 'last_ok', current_time( 'mysql' ) );
		return true;
	}
	sw_crm_note( 'last_error', current_time( 'mysql' ) . ' - ' . ( is_wp_error( $res ) ? $res->get_error_message() : 'HTTP ' . $code . ' ' . substr( wp_remote_retrieve_body( $res ), 0, 200 ) ) );
	return false;
}

function sw_crm_note( $field, $value ) {
	$status           = get_option( SW_CRM_STATUS, array() );
	$status[ $field ] = $value;
	update_option( SW_CRM_STATUS, $status, false );
}

/* -------------------------------------------------------------------------
 * Hourly retry of anything the CRM did not accept
 * ---------------------------------------------------------------------- */

add_action( 'sw_crm_retry', 'sw_crm_retry_queue' );

function sw_crm_retry_queue() {
	$queue = get_option( SW_CRM_QUEUE, array() );
	if ( ! $queue ) {
		return;
	}
	$left = array();
	foreach ( $queue as $enquiry ) {
		if ( ! sw_crm_send( $enquiry ) ) {
			$left[] = $enquiry;
		}
	}
	update_option( SW_CRM_QUEUE, $left, false );
}

register_activation_hook(
	__FILE__,
	function () {
		if ( ! wp_next_scheduled( 'sw_crm_retry' ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', 'sw_crm_retry' );
		}
	}
);

register_deactivation_hook(
	__FILE__,
	function () {
		wp_clear_scheduled_hook( 'sw_crm_retry' );
	}
);
