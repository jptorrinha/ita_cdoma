
def plot_outliers(title, df, column, plt, sns):
    
    df = df[column]

    title1 = f"Density probability {title}"
    title2 = f"Boxplot {title}"
    
    plt.figure(figsize=(15,7))
    plt.subplot(1,2,1)
    plt.title(title1, fontsize=15)
    sns.kdeplot(data = df)
    plt.subplot(1,2,2)
    plt.title(title2, fontsize=15)
    sns.boxplot(data = df, palette="Dark2")
    plt.show()

def treat_outliers(np, df, columns=None, factor=1.5, method='IQR', treatment='cap'):

    if columns is None:
        columns = df.columns

    for column in columns:
        if method == 'STD':
            col_std = df[column].std()
            col_mean = df[column].mean()
            floor = col_mean - factor * col_std
            ceil = col_mean + factor * col_std
        elif method == 'IQR':
            Q1 = df[column].quantile(0.25)
            Q3 = df[column].quantile(0.75)
            IQR = Q3 - Q1
            floor = Q1 - factor * IQR
            ceil = Q3 + factor * IQR

        if treatment == 'remove':
            df = df[(df[column] >= floor) & (df[column] <= ceil)]
        elif treatment == 'cap':
            df[column] = np.where(df[column] < floor, floor, 
                                 np.where(df[column] > ceil, ceil, df[column]))

    return df

def plot_feature_importance(importance_values, feature_names, title, plt, pd):
    # Create a DataFrame with feature names and importance values
    importance_df = pd.DataFrame({'Feature': feature_names, 'Importance': importance_values})
    importance_df = importance_df.sort_values(by='Importance', ascending=False)
    
    # Plot the feature importances
    plt.figure(figsize=(10, 6))
    plt.bar(importance_df['Feature'], importance_df['Importance'])
    plt.xlabel('Features')
    plt.ylabel('Importance')
    plt.title(title)
    plt.xticks(rotation=45)
    plt.show()