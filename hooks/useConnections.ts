interface Connection {
  id: string;
  name: string;
  title: string;
  avatar: string;
  connections: string[];
  department: string;
  yearsAtCompany: number;
}

export function useConnections() {
  const searchConnections = async (
    company: string,
    userBackground?: Record<string, any>
  ) => {
    try {
      const response = await fetch('/api/connections/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company,
          userBackground,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to search connections');
      }

      const data = await response.json();
      return data.connections as Connection[];
    } catch (error) {
      console.error('Connections Search Error:', error);
      throw error;
    }
  };

  const sendEmail = async (
    connectionId: string,
    emailDetails: {
      to: string;
      subject: string;
      content: string;
    }
  ) => {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...emailDetails,
          connectionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      return await response.json();
    } catch (error) {
      console.error('Email Error:', error);
      throw error;
    }
  };

  return {
    searchConnections,
    sendEmail,
  };
}
