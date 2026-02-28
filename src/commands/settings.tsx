import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getBlogConfig, saveBlogConfig, clearBlogConfig, syncBlogConfig } from '../lib/config.js';
import { updateBlog, deleteBlog, checkSubdomainAvailability } from '../lib/api.js';
import type { BlogConfig } from '../types/index.js';

type Step =
  | 'checking'
  | 'menu'
  | 'change-title'
  | 'change-subdomain'
  | 'delete-confirm'
  | 'working'
  | 'done'
  | 'error';

type MenuOption = 'title' | 'subdomain' | 'delete';

const MENU_OPTIONS: { key: MenuOption; label: string }[] = [
  { key: 'title', label: 'Change title' },
  { key: 'subdomain', label: 'Change subdomain' },
  { key: 'delete', label: 'Delete blog' },
];

function SettingsCommand() {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('checking');
  const [config, setConfig] = useState<BlogConfig | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [doneMessage, setDoneMessage] = useState('');
  const [error, setError] = useState('');
  const [subdomainError, setSubdomainError] = useState('');

  useEffect(() => {
    const init = async () => {
      const cfg = await syncBlogConfig();
      if (!cfg || !cfg.title) {
        setError('No blog found. Run `postt init` first.');
        setStep('error');
        return;
      }
      setConfig(cfg);
      setStep('menu');
    };

    init();
  }, []);

  const handleMenuSelect = (option: MenuOption) => {
    if (!config) return;

    if (option === 'title') {
      setInputValue(config.title);
      setStep('change-title');
    } else if (option === 'subdomain') {
      setInputValue(config.subdomain);
      setSubdomainError('');
      setStep('change-subdomain');
    } else if (option === 'delete') {
      setConfirmValue('');
      setStep('delete-confirm');
    }
  };

  const handleChangeTitle = async (value: string) => {
    const newTitle = value.trim();
    if (!newTitle || !config) return;

    setStep('working');
    try {
      const updated = await updateBlog(config.id, { title: newTitle });
      const newConfig: BlogConfig = { ...config, title: updated.title };
      await saveBlogConfig(newConfig);
      setConfig(newConfig);
      setDoneMessage(`Title updated to "${updated.title}"`);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update title');
      setStep('error');
    }
  };

  const handleChangeSubdomain = async (value: string) => {
    const newSubdomain = value.trim();
    if (!newSubdomain || !config) return;

    if (newSubdomain === config.subdomain) {
      setStep('menu');
      return;
    }

    setStep('working');
    try {
      const available = await checkSubdomainAvailability(newSubdomain);
      if (!available) {
        setSubdomainError(`"${newSubdomain}" is not available`);
        setInputValue(newSubdomain);
        setStep('change-subdomain');
        return;
      }

      const updated = await updateBlog(config.id, { subdomain: newSubdomain });
      const newUrl = `https://${updated.subdomain}.postt.io`;
      const newConfig: BlogConfig = { ...config, subdomain: updated.subdomain, url: newUrl };
      await saveBlogConfig(newConfig);
      setConfig(newConfig);
      setDoneMessage(`Subdomain updated to "${updated.subdomain}"`);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subdomain');
      setStep('error');
    }
  };

  const handleDeleteConfirm = async (value: string) => {
    if (!config) return;
    if (value.trim() !== config.subdomain) return;

    setStep('working');
    try {
      await deleteBlog(config.id);
      await clearBlogConfig();
      setDoneMessage('Blog deleted.');
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete blog');
      setStep('error');
    }
  };

  useInput((input, key) => {
    if (step === 'menu') {
      if (key.upArrow) {
        setMenuIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setMenuIndex((prev) => Math.min(MENU_OPTIONS.length - 1, prev + 1));
      } else if (key.return) {
        const option = MENU_OPTIONS[menuIndex];
        if (option) handleMenuSelect(option.key);
      } else if (key.escape || input === 'q') {
        exit();
      }
    } else if (step === 'change-title' || step === 'change-subdomain' || step === 'delete-confirm') {
      if (key.escape) {
        setStep('menu');
      }
    }
  });

  useEffect(() => {
    if (step === 'done' || step === 'error') {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [step, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      {step === 'checking' && <Text color="gray">Loading settings...</Text>}

      {step === 'menu' && config && (
        <Box flexDirection="column">
          <Text bold>Blog settings: </Text>
          <Text color="gray">{config.url}</Text>
          <Text> </Text>
          {MENU_OPTIONS.map((option, idx) => {
            const isCursor = idx === menuIndex;
            const isDelete = option.key === 'delete';
            return (
              <Box key={option.key}>
                <Text color={isDelete ? 'red' : isCursor ? 'cyan' : undefined}>
                  {isCursor ? '❯ ' : '  '}
                  {option.label}
                </Text>
              </Box>
            );
          })}
          <Text> </Text>
          <Text color="gray">Enter to select • q to cancel</Text>
        </Box>
      )}

      {step === 'change-title' && (
        <Box flexDirection="column">
          <Box>
            <Text color="cyan">? </Text>
            <Text>New title: </Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleChangeTitle}
            />
          </Box>
          <Text color="gray">Esc to go back</Text>
        </Box>
      )}

      {step === 'change-subdomain' && (
        <Box flexDirection="column">
          <Box>
            <Text color="cyan">? </Text>
            <Text>New subdomain: </Text>
            <TextInput
              value={inputValue}
              onChange={(val) => {
                setInputValue(val);
                setSubdomainError('');
              }}
              onSubmit={handleChangeSubdomain}
            />
          </Box>
          {subdomainError && <Text color="red">{subdomainError}</Text>}
          <Text color="gray">Esc to go back</Text>
        </Box>
      )}

      {step === 'delete-confirm' && config && (
        <Box flexDirection="column">
          <Text color="red" bold>This will permanently delete your blog and all posts.</Text>
          <Box>
            <Text>Type your subdomain to confirm: </Text>
            <TextInput
              value={confirmValue}
              onChange={setConfirmValue}
              onSubmit={handleDeleteConfirm}
              placeholder={config.subdomain}
            />
          </Box>
          <Text color="gray">Esc to go back</Text>
        </Box>
      )}

      {step === 'working' && <Text color="gray">Working...</Text>}

      {step === 'done' && <Text color="green">✓ {doneMessage}</Text>}

      {step === 'error' && <Text color="red">Error: {error}</Text>}
    </Box>
  );
}

export function runSettings() {
  render(<SettingsCommand />);
}
