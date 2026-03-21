const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const commands = new Map();

function loadCommands() {
    commands.clear();
    const commandsDir = path.join(__dirname, '../commands');
    if (!fs.existsSync(commandsDir)) {
        fs.mkdirSync(commandsDir);
    }
    
    const files = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
    let count = 0;
    
    for (const file of files) {
        try {
            const commandModule = require(path.join(commandsDir, file));
            
            if (Array.isArray(commandModule)) {
                for (const cmd of commandModule) {
                    commands.set(cmd.name, cmd);
                    if (cmd.aliases) {
                        cmd.aliases.forEach(alias => commands.set(alias, cmd));
                    }
                    count++;
                }
            } else if (commandModule.name) {
                commands.set(commandModule.name, commandModule);
                if (commandModule.aliases) {
                    commandModule.aliases.forEach(alias => commands.set(alias, commandModule));
                }
                count++;
            }
        } catch (e) {
            console.error(chalk.red(`Erreur lors du chargement de la commande ${file}:`), e);
        }
    }
    console.log(chalk.green(`✅ ${count} commandes chargées avec succès !`));
}

function getCommand(name) {
    return commands.get(name);
}

module.exports = {
    loadCommands,
    getCommand,
    commands
};
