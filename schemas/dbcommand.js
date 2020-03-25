const Database = require('pg');
const Fs = require('fs');

NEWSCHEMA('DBCommand', function(schema) {

	schema.define('connection', 'String', true);
	schema.define('query', 'String', true);

	var makeclient = function($) {

		var model = $.model;
		var index = model.connection.indexOf('hex ');

		if (index !== -1)
			model.connection = Buffer.from(model.connection.substring(index + 4).trim(), 'hex').toString('utf8');
		else {
			index = model.connection.indexOf('base64 ');
			if (index !== -1)
				model.connection = Buffer.from(model.connection.substring(index + 7).trim(), 'base64').toString('utf8');
			else
				model.connection = model.connection.trim();
		}

		return new Database.Client(model.connection);
	};

	schema.addWorkflow('exec', function($) {

		if (!$.user.sa && !$.user.dbviewer) {
			$.invalid('error-permissions');
			return;
		}

		var model = $.model;
		var client;

		try {
			client = makeclient($);
		} catch (e) {
			$.invalid(e);
			return;
		}

		var callback = function(err, response) {
			console.log(arguments);
			client.end();
			if (err)
				$.invalid(err);
			else
				$.success(response.rows);
		};

		if (model.query[0] === '-')
			model.query = 'SELECT CASE WHEN table_schema=\'public\' THEN \'\' ELSE table_schema || \'.\' END || "table_name" as name, CASE WHEN table_type=\'BASE TABLE\' THEN \'TABLE\' ELSE table_type END as type FROM information_schema.tables WHERE table_schema NOT IN (\'pg_catalog\', \'information_schema\') UNION ALL SELECT "routine_name" as name, routine_type as type FROM information_schema.routines WHERE routines.specific_schema=\'public\' LIMIT 150';
		else
			Fs.appendFile(PATH.logs('dbviewer.log'), JSON.stringify({ user: $.user.id, query: model.query, ip: $.ip, dtcreated: new Date(), database: client.connectionParameters ? (client.connectionParameters.host + '/' + client.connectionParameters.database) : 'not identified' }) + '\n', NOOP);

		client.connect(function(err) {

			if (err) {
				$.invalid(err);
				return;
			}

			var q = {};
			q.text = model.query;
			client.query(q, callback);
		});

	});

});